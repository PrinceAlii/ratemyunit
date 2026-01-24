import { Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface StarRatingProps {
  value: number;
  max?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StarRating({
  value,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange?.(star)}
          className={cn(
            'transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm',
            readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          )}
          disabled={readOnly}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= value
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}
