import React from 'react';
import { cn } from '@/lib/utils';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  closable?: boolean;
  onClose?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
  (
    {
      className,
      variant = 'neutral',
      closable = false,
      onClose,
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium rounded-md transition-all duration-250';

    const variantStyles = {
      primary: 'bg-brand-100 text-brand-700 border border-brand-200',
      success: 'bg-success-light text-success-700 border border-success-200',
      warning: 'bg-warning-light text-warning-700 border border-warning-200',
      error: 'bg-error-light text-error-700 border border-error-200',
      info: 'bg-info-light text-info-700 border border-info-200',
      neutral: 'bg-neutral-100 text-neutral-700 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300',
    };

    return (
      <span
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icon}
        {children}
        {closable && (
          <button
            type="button"
            onClick={onClose}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Tag.displayName = 'Tag';

export default Tag;
