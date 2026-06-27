import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  maskClosable?: boolean;
  draggable?: boolean;
  fullscreen?: boolean;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
  closable = true,
  maskClosable = true,
  draggable = false,
  fullscreen = false,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && closable) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEsc);
      // 禁止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, closable, onClose]);

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable || fullscreen) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // 重置位置
  useEffect(() => {
    if (!open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  if (!open) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  const handleMaskClick = (e: React.MouseEvent) => {
    if (maskClosable && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={handleMaskClick}
    >
      <div
        ref={modalRef}
        className={cn(
          'relative bg-white rounded-lg shadow-xl overflow-hidden',
          'dark:bg-neutral-900',
          'animate-in zoom-in-95 duration-200',
          fullscreen ? 'w-screen h-screen rounded-none' : widthStyles[width],
          draggable && !fullscreen && 'cursor-move',
          className
        )}
        style={
          draggable && !fullscreen
            ? {
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s',
              }
            : undefined
        }
      >
        {/* 标题栏 */}
        {(title || closable) && (
          <div
            className={cn(
              'flex items-center justify-between px-6 py-4 border-b border-neutral-200',
              'dark:border-neutral-700',
              draggable && !fullscreen && 'cursor-move'
            )}
            onMouseDown={handleMouseDown}
          >
            {title && (
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h3>
            )}
            <div className="flex-1" />
            {closable && (
              <button
                onClick={onClose}
                className={cn(
                  'p-1 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100',
                  'transition-colors duration-150',
                  'dark:hover:text-neutral-300 dark:hover:bg-neutral-800',
                  'cursor-pointer'
                )}
              >
                <svg
                  className="w-5 h-5"
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
          </div>
        )}

        {/* 内容区 */}
        <div
          className={cn(
            'px-6 py-4 overflow-y-auto',
            fullscreen ? 'h-[calc(100vh-140px)]' : 'max-h-[70vh]'
          )}
        >
          {children}
        </div>

        {/* 底部操作栏 */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';

export default Modal;
