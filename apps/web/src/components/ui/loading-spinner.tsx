import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

export function LoadingSpinner({ className, size = 'md', inline = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinner = (
    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
  );

  if (inline) {
    return spinner;
  }

  return (
    <div className="flex justify-center items-center p-4">
      {spinner}
    </div>
  );
}
