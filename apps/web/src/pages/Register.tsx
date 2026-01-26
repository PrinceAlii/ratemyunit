import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      await register(email, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
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
                We've sent a verification link to <span className="font-bold">{email}</span>
              </p>
              <p className="text-sm font-medium mt-4">
                Please check your email and click the link to verify your account before logging in.
              </p>
            </div>

            <Button onClick={() => navigate('/login')} className="w-full h-12 text-lg border-4">
              Go to Login
            </Button>
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
            <h1 className="text-4xl font-display font-black uppercase">Create Account</h1>
            <p className="text-lg font-medium">Sign up with your university email</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 text-sm font-bold text-red-700 bg-red-100 border-3 border-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold uppercase text-sm">University Email</Label>
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
              <p className="text-xs font-medium text-muted-foreground">
                Use your official university email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-bold uppercase text-sm">Password</Label>
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
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="text-sm text-center font-medium pt-2 border-t-3 border-border">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-bold">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
