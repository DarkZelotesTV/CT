import * as React from 'react';
import classNames from 'classnames';

export type CardVariant = 'surface' | 'elevated' | 'glass';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  surface: 'bg-[color:var(--color-surface)] border-[color:var(--color-border-subtle)] shadow-[var(--shadow-1)]',
  elevated: 'bg-[color:var(--color-surface)] border-[color:var(--color-border-subtle)] shadow-[var(--shadow-2)]',
  glass:
    'bg-[color:color-mix(in_srgb,var(--color-surface)_70%,transparent)] border-[color:var(--color-border-glass)] shadow-[var(--shadow-1)] backdrop-blur-xl glass',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = 'surface', ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={classNames('rounded-[var(--radius-4)] border text-[color:var(--color-text)]', variantClasses[variant], className)}
      {...props}
    />
  );
});

Card.displayName = 'Card';
