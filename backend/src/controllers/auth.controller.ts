import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { loginSchema, resetPasswordSchema, changePasswordSchema, verifyPinSchema } from '../validations/auth.validation.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import logger from '../config/logger.js';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'super_secret_access_key_123!@#';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_456!@#';

const parseCookies = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const parts = c.trim().split('=');
      return [parts[0], decodeURIComponent(parts[1] || '')];
    })
  );
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = loginSchema.parse(req.body);
    const { usernameOrEmail, password } = validated;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: usernameOrEmail } },
          { username: { equals: usernameOrEmail } },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: { message: 'Account is deactivated', code: 'DEACTIVATED' },
      });
    }

    // Lockout Check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        error: {
          message: `Account is locked. Try again in ${waitMinutes} minutes.`,
          code: 'LOCKED',
        },
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordMatch) {
      const newFailedLogins = user.failedLogins + 1;
      let lockoutUntil: Date | null = null;

      if (newFailedLogins >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: newFailedLogins,
          lockoutUntil,
        },
      });

      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
          details: {
            remainingAttempts: Math.max(0, 5 - newFailedLogins),
          },
        },
      });
    }

    // Reset Lockout upon success
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockoutUntil: null,
      },
    });

    // Generate Tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Save Session
    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    });

    // Write Audit Log
    const correlationId = (req as any).correlationId || crypto.randomUUID();
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        eventType: 'AUTH_LOGIN',
        description: `User ${user.username} logged in successfully`,
        correlationId,
        ipAddress: req.ip,
      },
    });

    // Set Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // If client wants to read raw header because cookie parser is not used
    res.setHeader('Set-Cookie', `refreshToken=${encodeURIComponent(refreshToken)}; HttpOnly; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; Path=/`);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { message: 'Refresh token is missing', code: 'REFRESH_TOKEN_MISSING' },
      });
    }

    try {
      jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' },
      });
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      return res.status(401).json({
        success: false,
        error: { message: 'Session expired or user inactive', code: 'SESSION_EXPIRED' },
      });
    }

    // Generate New Access Token
    const accessToken = jwt.sign(
      { id: session.user.id, email: session.user.email, role: session.user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies.refreshToken;

    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { refreshToken },
      });
    }

    res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Max-Age=0; SameSite=Lax; Path=/');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email is required', code: 'EMAIL_REQUIRED' },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpires,
        },
      });

      // In development, log the reset token
      logger.info(`[Forgot Password] Reset token for ${email}: ${resetToken}`);
    }

    // Always return success to prevent user enumeration
    res.status(200).json({
      success: true,
      message: 'If the email exists in our system, a password reset link has been generated.',
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = resetPasswordSchema.parse(req.body);
    const { token, password } = validated;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired reset token', code: 'INVALID_RESET_TOKEN' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        failedLogins: 0,
        lockoutUntil: null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = changePasswordSchema.parse(req.body);
    const { oldPassword, newPassword } = validated;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'NOT_FOUND' },
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: { message: 'Incorrect current password', code: 'INCORRECT_PASSWORD' },
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const verifyPin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = verifyPinSchema.parse(req.body);
    const { pin } = validated;

    // Search for any active Admin or Manager with this pin
    const managers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
        isActive: true,
        pinHash: {
          not: null,
        },
      },
    });

    let verifiedUser = null;
    for (const manager of managers) {
      if (manager.pinHash) {
        const isMatch = await bcrypt.compare(pin, manager.pinHash);
        if (isMatch) {
          verifiedUser = manager;
          break;
        }
      }
    }

    if (!verifiedUser) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid override PIN', code: 'INVALID_PIN' },
      });
    }

    // Log the override event
    const correlationId = req.correlationId || crypto.randomUUID();
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        eventType: 'ADMIN_OVERRIDE',
        description: `Manager override PIN verified for user ${verifiedUser.username}`,
        correlationId,
        ipAddress: req.ip,
        metadata: {
          overrideByUserId: verifiedUser.id,
          overrideByUsername: verifiedUser.username,
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Override approved',
        approvedBy: {
          id: verifiedUser.id,
          username: verifiedUser.username,
          role: verifiedUser.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'NOT_FOUND' },
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

