import * as React from 'react';
import classNames from 'classnames';

import { Card, type CardVariant } from './Card';

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'muted' | 'default' | 'accent';
  className?: string;
  variant?: CardVariant;
};

const toneClasses: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  muted:
    'bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)]/60',
  default: 'bg-[color:var(--color-surface)] text-[color:var(--color-text)] border border-[color:var(--color-border)]/60',
  accent: 'bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] border border-[color:var(--color-accent)]/30',
};

export const EmptyState = ({
  icon,
  title,
  description,
  actions,
  tone = 'muted',
  className,
  variant = 'surface',
}: EmptyStateProps) => {
  return (
    <Card
      variant={variant}
      className={classNames(
        'flex flex-col items-center gap-4 text-center px-8 py-10',
        className
      )}
    >
      {icon ? (
        <div
          className={classNames(
            'flex h-12 w-12 items-center justify-center rounded-full shadow-[var(--shadow-1)]',
            toneClasses[tone]
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        {description ? (
          <p className="text-sm text-[color:var(--color-text-muted)] max-w-md leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-3 pt-2">{actions}</div> : null}
    </Card>
  );
};
