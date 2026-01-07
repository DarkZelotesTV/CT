import * as React from 'react';
import classNames from 'classnames';

export type ToggleProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: 'sm' | 'md' | 'lg';
};

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, size = 'md', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={classNames(
          'rounded-[var(--radius-sm)] border border-[color:var(--color-border)]',
          'bg-[color:var(--color-surface)] text-[color:var(--color-accent)]',
          'accent-[color:var(--color-accent)]',
          'transition-colors',
          'focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/40',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' && 'h-3 w-3',
          size === 'md' && 'h-4 w-4',
          size === 'lg' && 'h-5 w-5',
          className,
        )}
        {...props}
      />
    );
  },
);
Toggle.displayName = 'Toggle';
