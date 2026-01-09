import classNames from 'classnames';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  size?: 'default' | 'compact';
}

export const ErrorCard = ({ title, message, onRetry, retryLabel = 'Retry', className, size = 'default' }: ErrorCardProps) => {
  const isCompact = size === 'compact';

  return (
    <div
      role="alert"
      className={classNames(
        'rounded-lg border border-[color:color-mix(in_srgb,var(--color-text-danger)_30%,transparent)] bg-gradient-to-br from-[color:color-mix(in_srgb,var(--color-text-danger)_18%,transparent)] via-[color:color-mix(in_srgb,var(--color-text-danger)_12%,transparent)] to-transparent text-[color:var(--color-text-danger-light)] shadow-[0_12px_30px_color-mix(in_srgb,var(--color-text-danger)_20%,transparent)] backdrop-blur-sm',
        isCompact ? 'px-2.5 py-2 text-xs' : 'px-3.5 py-3 text-sm',
        className
      )}
    >
      <div className={classNames('flex', isCompact ? 'gap-2' : 'gap-3')}>
        <div className={classNames('flex items-start text-[color:var(--color-text-danger)]', isCompact ? 'pt-0' : 'pt-0.5')}>
          <AlertTriangle size={isCompact ? 14 : 18} aria-hidden />
        </div>
        <div className={classNames('flex-1', isCompact ? 'space-y-0.5' : 'space-y-1')}>
          {title ? <div className={classNames('font-semibold text-[color:var(--color-text-danger)]', isCompact ? 'text-sm' : undefined)}>{title}</div> : null}
          <div className={classNames('text-[color:var(--color-text-danger-light)]', isCompact ? 'text-xs' : undefined)}>{message}</div>
          {onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={classNames(
                'inline-flex items-center gap-2 rounded-md bg-[color:color-mix(in_srgb,var(--color-text-danger)_22%,transparent)] font-semibold text-[color:var(--color-text-danger-light)] transition hover:bg-[color:color-mix(in_srgb,var(--color-text-danger)_30%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--color-text-danger)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
              )}
              onClick={onRetry}
            >
              <RefreshCcw size={isCompact ? 12 : 14} aria-hidden />
              <span>{retryLabel}</span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
