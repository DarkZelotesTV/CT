import * as React from 'react';
import classNames from 'classnames';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Minimal, theme-aware Button primitives (Tailwind + CSS variables).
 * Used by Voice UI and can be reused across the app.
 */
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={classNames(
          // base
          'inline-flex items-center justify-center gap-2 font-semibold',
          'rounded-xl transition active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          // sizing
          size === 'sm' && 'h-9 px-3 text-sm',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-11 px-5 text-base',
          size === 'icon' && 'h-10 w-10 p-0',
          // variants
          variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover shadow-neon',
          variant === 'secondary' && 'bg-surface-alt text-text hover:bg-surface-hover border border-border',
          variant === 'ghost' && 'bg-transparent text-text hover:bg-surface-hover border border-transparent',
          variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export type IconButtonProps = Omit<ButtonProps, 'size'> & {
  size?: 'sm' | 'md' | 'lg';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', ...props }, ref) => {
    const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
    return (
      <Button
        ref={ref}
        size="icon"
        variant={variant}
        className={classNames('rounded-2xl', dim, className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export type ToggleIconButtonProps = Omit<IconButtonProps, 'aria-pressed'> & {
  pressed?: boolean;
};

export const ToggleIconButton = React.forwardRef<HTMLButtonElement, ToggleIconButtonProps>(
  ({ pressed, className, variant = 'secondary', ...props }, ref) => {
    return (
      <IconButton
        ref={ref}
        variant={variant}
        aria-pressed={pressed}
        className={classNames(
          // pressed treatment
          pressed ? 'bg-accent text-white hover:bg-accent-hover border-transparent shadow-neon' : null,
          className,
        )}
        {...props}
      />
    );
  },
);
ToggleIconButton.displayName = 'ToggleIconButton';
