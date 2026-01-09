import * as React from 'react';
import classNames from 'classnames';

import { Card, type CardVariant } from './Card';

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: CardVariant;
};

export const EmptyState = ({ icon, title, body, action, className, variant = 'surface' }: EmptyStateProps) => {
  return (
    <Card
      variant={variant}
      className={classNames(
        'flex flex-col items-center gap-4 text-center px-8 py-10',
        className
      )}
    >
      {icon ? (
        <div className="flex items-center justify-center rounded-full bg-[color:var(--color-surface-hover)] p-3 text-[color:var(--color-text-muted)] shadow-[var(--shadow-1)]">
          {icon}
        </div>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        {body ? <p className="text-sm text-[color:var(--color-text-muted)] max-w-md">{body}</p> : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </Card>
  );
};
