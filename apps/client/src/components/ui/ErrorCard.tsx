import classNames from 'classnames';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorCard = ({ title, message, onRetry, retryLabel = 'Retry', className }: ErrorCardProps) => (
  <div
    role="alert"
    className={classNames('rounded-md border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-100', className)}
  >
    <div className="flex gap-3">
      <div className="flex items-start pt-0.5 text-red-200">
        <AlertTriangle size={18} aria-hidden />
      </div>
      <div className="flex-1 space-y-1">
        {title ? <div className="font-semibold text-red-50">{title}</div> : null}
        <div className="text-red-50/90">{message}</div>
        {onRetry ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-50 transition hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121317]"
            onClick={onRetry}
          >
            <RefreshCcw size={14} aria-hidden />
            <span>{retryLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  </div>
);
