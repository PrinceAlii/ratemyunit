import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="inline-block px-8 py-6 bg-secondary text-secondary-foreground border-extra-thick border-foreground shadow-neo-xl mb-6">
        <h1 className="text-8xl md:text-9xl font-display font-black">404</h1>
      </div>
      <div className="p-8 border-4 border-foreground bg-card shadow-neo max-w-lg">
        <h2 className="text-3xl font-display font-black uppercase mb-4">Page Not Found</h2>
        <p className="text-lg font-medium mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/">
          <Button size="lg" className="h-14 text-lg border-4 min-w-[200px]">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
