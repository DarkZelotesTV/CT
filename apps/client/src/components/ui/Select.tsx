import * as React from 'react';
import classNames from 'classnames';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  selectSize?: 'sm' | 'md' | 'lg';
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, selectSize = 'md', ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={classNames(
          'w-full border bg-[color:var(--color-surface)] text-[color:var(--color-text)]',
          'border-[color:var(--color-border)] rounded-[var(--radius-md)]',
          'transition-colors outline-none',
          'focus-visible:border-[color:var(--color-focus)]',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)]',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          selectSize === 'sm' && 'px-3 py-2 text-xs',
          selectSize === 'md' && 'px-3 py-2 text-sm',
          selectSize === 'lg' && 'px-4 py-3 text-base',
          className,
        )}
        {...props}
      />
    );
  },
);
Select.displayName = 'Select';
