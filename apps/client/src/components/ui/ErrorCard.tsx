import classNames from 'classnames';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

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
        'rounded-md border border-red-500/40 bg-red-500/10 text-red-100',
        isCompact ? 'px-2.5 py-2 text-xs' : 'px-3 py-3 text-sm',
        className
      )}
    >
      <div className={classNames('flex', isCompact ? 'gap-2' : 'gap-3')}>
        <div className={classNames('flex items-start text-red-200', isCompact ? 'pt-0' : 'pt-0.5')}>
          <AlertTriangle size={isCompact ? 14 : 18} aria-hidden />
        </div>
        <div className={classNames('flex-1', isCompact ? 'space-y-0.5' : 'space-y-1')}>
          {title ? <div className={classNames('font-semibold text-red-50', isCompact ? 'text-sm' : undefined)}>{title}</div> : null}
          <div className={classNames('text-red-50/90', isCompact ? 'text-xs' : undefined)}>{message}</div>
          {onRetry ? (
            <button
              type="button"
              className={classNames(
                'inline-flex items-center gap-2 rounded-md bg-red-500/20 font-semibold text-red-50 transition hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]',
                isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
              )}
              onClick={onRetry}
            >
              <RefreshCcw size={isCompact ? 12 : 14} aria-hidden />
              <span>{retryLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
