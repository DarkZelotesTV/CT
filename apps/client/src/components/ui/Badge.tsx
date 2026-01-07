import * as React from 'react';
import classNames from 'classnames';

export type BadgeVariant = 'neutral' | 'accent';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export const Badge = ({ className, variant = 'neutral', ...props }: BadgeProps) => {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 border text-xs font-semibold',
        'rounded-[var(--radius-pill)] px-2.5 py-1',
        variant === 'neutral' && 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70 text-[color:var(--color-text)]',
        variant === 'accent' && 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]',
        className,
      )}
      {...props}
    />
  );
};
