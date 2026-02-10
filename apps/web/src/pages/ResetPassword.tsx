import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/reset-password', { token, password });
      toast.success('Password reset successfully! Please log in with your new password.');
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-md">
          <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl font-display font-black uppercase">Invalid Link</h1>
              <p className="text-lg font-medium">
                This password reset link is invalid or has expired.
              </p>
            </div>

            <Link to="/forgot-password">
              <Button className="w-full h-12 text-lg border-4">
                Request New Reset Link
              </Button>
            </Link>

            <div className="text-sm text-center font-medium pt-2 border-t-3 border-border">
              <Link to="/login" className="text-primary hover:underline font-bold">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <div className="w-full max-w-md">
        <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-display font-black uppercase">Reset Password</h1>
            <p className="text-lg font-medium">Enter your new password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 text-sm font-bold text-red-700 bg-red-100 border-3 border-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="font-bold uppercase text-sm">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-3"
              />
              <p className="text-xs font-medium text-muted-foreground">At least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-bold uppercase text-sm">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-3"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg border-4" disabled={loading}>
              {loading ? 'Resetting password...' : 'Reset Password'}
            </Button>
          </form>

          <div className="text-sm text-center font-medium pt-2 border-t-3 border-border">
            Remember your password?{' '}
            <Link to="/login" className="text-primary hover:underline font-bold">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
