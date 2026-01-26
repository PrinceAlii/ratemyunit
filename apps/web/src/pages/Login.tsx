import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-8">
      <div className="w-full max-w-md">
        <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-display font-black uppercase">Welcome Back</h1>
            <p className="text-lg font-medium">Login to your RateMyUnit account</p>
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
            </div>

            <Button type="submit" className="w-full h-12 text-lg border-4" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>

            <div className="text-sm text-center">
              <Link to="/forgot-password" className="text-primary hover:underline font-bold">
                Forgot password?
              </Link>
            </div>
          </form>

          <div className="text-sm text-center font-medium pt-2 border-t-3 border-border">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-bold">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
