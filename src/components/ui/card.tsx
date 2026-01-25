import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-gray-200', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold text-gray-900', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-gray-600 mt-1', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('px-6 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg', className)}
      {...props}
    />
  );
}
