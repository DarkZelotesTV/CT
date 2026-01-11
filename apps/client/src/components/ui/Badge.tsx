import * as React from 'react';
import classNames from 'classnames';
import { Pill } from './Pill';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export const Badge = ({ className, variant = 'neutral', ...props }: BadgeProps) => {
  return (
    <Pill
      className={classNames(
        'gap-1 font-semibold',
        variant === 'neutral' && 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70 text-[color:var(--color-text)]',
        variant === 'accent' && 'border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]',
        variant === 'success' && 'border-[color:var(--color-text-success)]/40 bg-[color:var(--color-text-success)]/10 text-[color:var(--color-text-success)]',
        variant === 'warning' && 'border-[color:var(--color-text-warning)]/40 bg-[color:var(--color-text-warning)]/10 text-[color:var(--color-text-warning)]',
        variant === 'danger' && 'border-[color:var(--color-text-danger)]/40 bg-[color:var(--color-text-danger)]/10 text-[color:var(--color-text-danger)]',
        variant === 'info' && 'border-[color:var(--color-text-info)]/40 bg-[color:var(--color-text-info)]/10 text-[color:var(--color-text-info)]',
        className,
      )}
      {...props}
    />
  );
};
