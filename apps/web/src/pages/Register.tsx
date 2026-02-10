import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';
import type { University } from '@ratemyunit/types';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUniversities, setLoadingUniversities] = useState(true);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUniversities = async () => {
      try {
        const data = await api.get<University[]>('/api/public/universities');
        setUniversities(data);
      } catch (err) {
        console.error('Failed to fetch universities:', err);
      } finally {
        setLoadingUniversities(false);
      }
    };
    fetchUniversities();
  }, []);

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

    if (!displayName || displayName.length < 2) {
      setError('Display name must be at least 2 characters');
      setLoading(false);
      return;
    }

    if (!universityId) {
      setError('Please select your university');
      setLoading(false);
      return;
    }

    try {
      await register(email, password, displayName, universityId);
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
              <Label htmlFor="displayName" className="font-bold uppercase text-sm">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="John Smith"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-3"
              />
              <p className="text-xs font-medium text-muted-foreground">
                Your name as it will appear on reviews (if you choose to show it)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold uppercase text-sm">University Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="student@university.edu.au"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 border-3"
              />
              <p className="text-xs font-medium text-muted-foreground">
                Use your .edu.au email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="university" className="font-bold uppercase text-sm">University</Label>
              <select
                id="university"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                required
                disabled={loading || loadingUniversities}
                className="w-full h-12 border-3 border-foreground bg-background px-3 font-medium shadow-neo transition-all hover:shadow-neo-hover focus:shadow-neo-hover focus:outline-none disabled:opacity-50"
              >
                <option value="">Select your university</option>
                {universities.map((uni) => (
                  <option key={uni.id} value={uni.id}>
                    {uni.name}
                  </option>
                ))}
              </select>
              <p className="text-xs font-medium text-muted-foreground">
                Select the university you attend
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
