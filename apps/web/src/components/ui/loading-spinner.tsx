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
    <div className={cn('relative', sizeClasses[size], className)}>
      <div className="absolute inset-0 border-3 border-black bg-primary animate-spin" />
      <div className="absolute inset-0 border-3 border-transparent border-t-black animate-spin" />
    </div>
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
