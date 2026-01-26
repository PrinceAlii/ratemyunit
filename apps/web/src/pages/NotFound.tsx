import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-muted-foreground mb-8 text-lg">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/">
        <Button size="lg">Go Home</Button>
      </Link>
    </div>
  );
}
