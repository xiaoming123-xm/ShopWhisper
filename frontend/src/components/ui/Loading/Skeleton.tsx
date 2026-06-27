import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'list' | 'table';
  width?: string | number;
  height?: string | number;
  rows?: number;
  className?: string;
  animated?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  rows = 3,
  className,
  animated = true,
}) => {
  const baseStyles = cn(
    'bg-neutral-200 dark:bg-neutral-700',
    animated && 'animate-pulse'
  );

  const getVariantStyles = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      case 'card':
        return null; // 特殊处理
      case 'list':
        return null; // 特殊处理
      case 'table':
        return null; // 特殊处理
      default:
        return 'h-4 rounded';
    }
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  // 卡片骨架屏
  if (variant === 'card') {
    return (
      <div className={cn('p-4 border border-neutral-200 rounded-lg dark:border-neutral-700', className)}>
        <div className={cn(baseStyles, 'h-40 rounded-md mb-4')} />
        <div className={cn(baseStyles, 'h-6 rounded mb-2')} style={{ width: '60%' }} />
        <div className={cn(baseStyles, 'h-4 rounded mb-2')} />
        <div className={cn(baseStyles, 'h-4 rounded')} style={{ width: '80%' }} />
      </div>
    );
  }

  // 列表骨架屏
  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={cn(baseStyles, 'w-10 h-10 rounded-full flex-shrink-0')} />
            <div className="flex-1 space-y-2">
              <div className={cn(baseStyles, 'h-4 rounded')} style={{ width: '40%' }} />
              <div className={cn(baseStyles, 'h-3 rounded')} style={{ width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 表格骨架屏
  if (variant === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        {/* 表头 */}
        <div className="flex gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-700">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cn(baseStyles, 'h-4 rounded flex-1')} />
          ))}
        </div>
        {/* 表格行 */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 py-3">
            {Array.from({ length: 4 }).map((_, colIndex) => (
              <div key={colIndex} className={cn(baseStyles, 'h-4 rounded flex-1')} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // 文本行骨架屏
  if (variant === 'text' && rows > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(baseStyles, getVariantStyles())}
            style={{
              ...style,
              width: index === rows - 1 ? '80%' : style.width || '100%',
            }}
          />
        ))}
      </div>
    );
  }

  // 基础骨架屏
  return (
    <div
      className={cn(baseStyles, getVariantStyles(), className)}
      style={style}
    />
  );
};

Skeleton.displayName = 'Skeleton';

export default Skeleton;