import { Link, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth-context';
import { Button } from './ui/button';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-4 border-black bg-primary">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-3xl font-black uppercase tracking-tight text-primary-foreground">
            RateMyUnit
          </Link>

          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <Link to="/admin">
                <Button variant="outline" className="font-bold uppercase border-2 border-black">
                  Admin
                </Button>
              </Link>
            )}
            {user ? (
              <>
                {user.role !== 'admin' && (
                  <span className="text-sm font-bold text-primary-foreground hidden sm:inline-block">
                    {user.displayName || user.email}
                  </span>
                )}
                <Button variant="outline" onClick={handleLogout} className="border-2 border-black">
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" className="border-2 border-black">Login</Button>
                </Link>
                <Link to="/register">
                  <Button className="border-2 border-black shadow-neo">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <footer className="border-t-4 border-black py-6 bg-secondary">
        <div className="container mx-auto px-4 text-center text-sm font-bold uppercase text-secondary-foreground">
          &copy; {new Date().getFullYear()} RateMyUnit. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
