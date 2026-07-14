import { z } from 'zod';

export const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3, 'Username or Email must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'New password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6, 'Old password must be at least 6 characters'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const verifyPinSchema = z.object({
  pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d+$/, 'PIN must contain only digits'),
});
