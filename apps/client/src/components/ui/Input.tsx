import * as React from 'react';
import classNames from 'classnames';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: 'sm' | 'md' | 'lg';
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize = 'md', type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={classNames(
          'w-full border bg-[color:var(--color-surface)] text-[color:var(--color-text)]',
          'border-[color:var(--color-border)] rounded-[var(--radius-3)]',
          'transition-colors outline-none',
          'placeholder:text-[color:var(--color-text-muted)]',
          'focus-visible:border-[color:var(--state-focus)]',
          'focus-visible:ring-2 focus-visible:ring-[color:var(--state-focus)]',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
          inputSize === 'sm' && 'px-3 py-2 text-xs',
          inputSize === 'md' && 'px-3 py-2 text-sm',
          inputSize === 'lg' && 'px-4 py-3 text-base',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
