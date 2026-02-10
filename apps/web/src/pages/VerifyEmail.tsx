import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError('Invalid or missing verification token');
        setLoading(false);
        return;
      }

      try {
        await api.post('/api/auth/verify-email', { token });
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify email');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-md">
          <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl font-display font-black uppercase">Verifying Email</h1>
              <p className="text-lg font-medium">Please wait while we verify your email...</p>
              <div className="flex justify-center pt-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-foreground border-t-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container flex items-center justify-center min-h-screen py-8">
        <div className="w-full max-w-md">
          <div className="p-8 border-extra-thick border-foreground bg-card shadow-neo-xl space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl font-display font-black uppercase">Email Verified</h1>
              <p className="text-lg font-medium">
                Your email has been verified successfully! You can now log in to your account.
              </p>
            </div>

            <Link to="/login">
              <Button className="w-full h-12 text-lg border-4">
                Go to Login
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
            <h1 className="text-4xl font-display font-black uppercase">Verification Failed</h1>
            <p className="text-lg font-medium">
              This verification link is invalid or has expired.
            </p>
            {error && (
              <div className="p-4 text-sm font-bold text-red-700 bg-red-100 border-3 border-red-700">
                {error}
              </div>
            )}
          </div>

          <Link to="/register">
            <Button className="w-full h-12 text-lg border-4">
              Create New Account
            </Button>
          </Link>

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
