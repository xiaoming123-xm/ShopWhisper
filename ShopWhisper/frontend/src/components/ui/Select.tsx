import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | number | (string | number)[];
  defaultValue?: string | number | (string | number)[];
  onChange?: (value: string | number | (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onChange,
      placeholder = '请选择',
      disabled = false,
      multiple = false,
      searchable = false,
      className,
      size = 'md',
    }
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [internalValue, setInternalValue] = useState<string | number | (string | number)[]>(
      value ?? defaultValue ?? (multiple ? [] : '')
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 同步外部 value
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // 点击外部关闭下拉
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    // 打开时聚焦搜索框
    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    // 过滤选项
    const filteredOptions = searchable && searchQuery
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

    // 获取显示文本
    const getDisplayText = () => {
      if (multiple && Array.isArray(internalValue)) {
        if (internalValue.length === 0) return placeholder;
        const selectedLabels = options
          .filter((opt) => internalValue.includes(opt.value))
          .map((opt) => opt.label);
        return selectedLabels.join(', ');
      } else {
        const selected = options.find((opt) => opt.value === internalValue);
        return selected ? selected.label : placeholder;
      }
    };

    // 处理选项点击
    const handleOptionClick = (optionValue: string | number) => {
      let newValue: string | number | (string | number)[];

      if (multiple) {
        const currentArray = Array.isArray(internalValue) ? internalValue : [];
        if (currentArray.includes(optionValue)) {
          newValue = currentArray.filter((v) => v !== optionValue);
        } else {
          newValue = [...currentArray, optionValue];
        }
      } else {
        newValue = optionValue;
        setIsOpen(false);
      }

      setInternalValue(newValue);
      onChange?.(newValue);
      setSearchQuery('');
    };

    // 判断选项是否被选中
    const isSelected = (optionValue: string | number) => {
      if (multiple && Array.isArray(internalValue)) {
        return internalValue.includes(optionValue);
      }
      return internalValue === optionValue;
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-3 text-lg',
    };

    return (
      <div ref={containerRef} className={cn('relative w-full', className)}>
        {/* 选择框 */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'w-full flex items-center justify-between gap-2 bg-white border border-neutral-200 rounded-md transition-all duration-200',
            'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-neutral-200',
            'dark:bg-neutral-800 dark:border-neutral-700 dark:hover:border-primary',
            sizeStyles[size],
            isOpen && 'border-primary ring-2 ring-primary ring-offset-1'
          )}
        >
          <span
            className={cn(
              'truncate text-left flex-1',
              !getDisplayText() || getDisplayText() === placeholder
                ? 'text-neutral-400'
                : 'text-neutral-900 dark:text-neutral-100'
            )}
          >
            {getDisplayText()}
          </span>
          <svg
            className={cn(
              'w-4 h-4 text-neutral-500 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 下拉列表 */}
        {isOpen && (
          <div
            className={cn(
              'absolute z-dropdown mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg',
              'max-h-60 overflow-auto',
              'dark:bg-neutral-800 dark:border-neutral-700',
              'animate-in fade-in-0 zoom-in-95 duration-200'
            )}
          >
            {/* 搜索框 */}
            {searchable && (
              <div className="p-2 border-b border-neutral-200 dark:border-neutral-700">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className={cn(
                    'w-full px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                    'dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100'
                  )}
                />
              </div>
            )}

            {/* 选项列表 */}
            <div className="py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-2 text-sm text-neutral-400 text-center">
                  无匹配选项
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && handleOptionClick(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm transition-colors duration-150',
                      'hover:bg-brand-50 dark:hover:bg-brand-900',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelected(option.value) &&
                        'bg-brand-100 text-primary font-medium dark:bg-brand-900',
                      !isSelected(option.value) && 'text-neutral-900 dark:text-neutral-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{option.label}</span>
                      {multiple && isSelected(option.value) && (
                        <svg
                          className="w-4 h-4 text-primary flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
