import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-md">
          <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl font-display font-black uppercase">Check Your Email</h1>
              <p className="text-lg font-medium">
                If an account exists with this email, a password reset link has been sent.
              </p>
              <p className="text-sm font-medium mt-4">
                Please check your email and follow the instructions to reset your password.
              </p>
            </div>

            <Link to="/login">
              <Button className="w-full h-12 text-lg border-4">
                Back to Login
              </Button>
            </Link>
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
            <h1 className="text-4xl font-display font-black uppercase">Forgot Password</h1>
            <p className="text-lg font-medium">Enter your email to reset your password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 text-sm font-bold text-red-700 bg-red-100 border-3 border-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold uppercase text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@student.uts.edu.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-3"
              />
            </div>

            <Button type="submit" className="w-full h-12 text-lg border-4" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            <div className="text-sm text-center">
              <Link to="/login" className="text-primary hover:underline font-bold">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
