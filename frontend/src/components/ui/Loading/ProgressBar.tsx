import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'linear' | 'circular';
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = 'linear',
  size = 'md',
  color = 'primary',
  showLabel = false,
  className,
}) => {
  // 确保 value 在 0-100 之间
  const clampedValue = Math.min(100, Math.max(0, value));

  const colorStyles = {
    primary: 'bg-primary',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500',
  };

  // 线性进度条
  if (variant === 'linear') {
    const heightStyles = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div className={cn('w-full', className)}>
        <div
          className={cn(
            'w-full bg-neutral-200 rounded-full overflow-hidden dark:bg-neutral-700',
            heightStyles[size]
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300 ease-out',
              colorStyles[color]
            )}
            style={{ width: `${clampedValue}%` }}
          />
        </div>
        {showLabel && (
          <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 text-right">
            {clampedValue}%
          </div>
        )}
      </div>
    );
  }

  // 环形进度条
  if (variant === 'circular') {
    const sizeMap = {
      sm: { size: 40, strokeWidth: 3 },
      md: { size: 60, strokeWidth: 4 },
      lg: { size: 80, strokeWidth: 5 },
    };

    const { size: svgSize, strokeWidth } = sizeMap[size];
    const radius = (svgSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div className={cn('relative inline-flex items-center justify-center', className)}>
        <svg width={svgSize} height={svgSize} className="transform -rotate-90">
          {/* 背景圆环 */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-neutral-200 dark:text-neutral-700"
          />
          {/* 进度圆环 */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(
              'transition-all duration-300 ease-out',
              color === 'primary' && 'text-primary',
              color === 'success' && 'text-success-500',
              color === 'warning' && 'text-warning-500',
              color === 'error' && 'text-error-500'
            )}
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {clampedValue}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
};

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;