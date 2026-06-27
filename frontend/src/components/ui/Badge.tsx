import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  count?: number;
  children?: React.ReactNode;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      dot = false,
      count,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-250';

    const variantStyles = {
      primary: 'bg-primary text-white',
      success: 'bg-success text-white',
      warning: 'bg-warning text-white',
      error: 'bg-error text-white',
      info: 'bg-info text-white',
      neutral: 'bg-neutral-500 text-white',
    };

    const sizeStyles = {
      sm: dot ? 'w-2 h-2' : 'px-2 py-0.5 text-xs min-w-[18px]',
      md: dot ? 'w-2.5 h-2.5' : 'px-2.5 py-1 text-sm min-w-[22px]',
      lg: dot ? 'w-3 h-3' : 'px-3 py-1.5 text-base min-w-[26px]',
    };

    if (dot) {
      return (
        <span
          ref={ref}
          className={cn(
            baseStyles,
            variantStyles[variant],
            sizeStyles[size],
            'animate-pulse',
            className
          )}
          {...props}
        />
      );
    }

    const displayCount = count !== undefined && count > 99 ? '99+' : count;

    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {displayCount !== undefined ? displayCount : children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
