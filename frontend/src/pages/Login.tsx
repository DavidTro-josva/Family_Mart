import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../App.tsx';
import api from '../services/api.ts';
import { useNavigate } from 'react-router-dom';

const loginFormSchema = z.object({
  usernameOrEmail: z.string().min(3, 'Username or email is too short'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export const Login: React.FC = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      usernameOrEmail: '',
      password: '',
      rememberMe: false,
    },
  });

  console.log('Login Render:', { errors, formValues: watch() });

  const onSubmit = async (data: LoginFormValues) => {
    console.log('onSubmit called', data);
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', {
        usernameOrEmail: data.usernameOrEmail,
        password: data.password,
      });

      const { accessToken, user } = response.data.data;
      login(accessToken, user);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errMsg = (err as any).response?.data?.error?.message || 'Something went wrong. Please try again.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-brand-blue-950 to-brand-green-950 p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8 text-white">
        {/* Brand Logo */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-green-500 to-brand-blue-500 flex items-center justify-center text-2xl font-bold shadow-lg shadow-brand-green-500/10">
          TDS
        </div>
        
        <h2 className="text-2xl font-display font-bold text-center mb-1">Thangam Store</h2>
        <p className="text-slate-400 text-sm text-center mb-8">Sign in to manage retail operations & financial ledgers</p>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-semibold">Login Failed</p>
              <p className="text-red-300/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, (err) => console.log('Validation errors:', err))} className="space-y-5">
          {/* Username / Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Username or Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User size={18} />
              </span>
              <input
                type="text"
                disabled={isLoading}
                placeholder="Enter your username or email"
                {...register('usernameOrEmail')}
                className={`w-full pl-10 pr-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue-500/20 focus:border-brand-blue-500 transition-all duration-200 text-white placeholder-slate-500
                  ${errors.usernameOrEmail ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}
                `}
              />
            </div>
            {errors.usernameOrEmail && (
              <p className="text-xs text-red-400 font-medium mt-1">{errors.usernameOrEmail.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={isLoading}
                placeholder="••••••••"
                {...register('password')}
                className={`w-full pl-10 pr-10 py-3 bg-white/5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue-500/20 focus:border-brand-blue-500 transition-all duration-200 text-white placeholder-slate-500
                  ${errors.password ? 'border-red-500/50 focus:border-red-500' : 'border-white/10'}
                `}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 font-medium mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isLoading}
                {...register('rememberMe')}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-brand-blue-600 focus:ring-brand-blue-500/20 focus:ring-offset-slate-900"
              />
              <span className="text-sm text-slate-300">Remember Me</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-brand-green-500 to-brand-blue-600 hover:from-brand-green-600 hover:to-brand-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-brand-blue-500/20 hover:shadow-brand-blue-500/30 transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
