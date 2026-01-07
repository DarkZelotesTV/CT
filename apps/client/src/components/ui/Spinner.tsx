import classNames from 'classnames';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

export const Spinner = ({ className, size = 18, label }: SpinnerProps) => {
  const accessibleLabel = useMemo(() => label ?? 'Loading', [label]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames('flex items-center gap-2 text-[color:var(--color-text-muted)]', className)}
    >
      <Loader2
        aria-hidden
        size={size}
        className="animate-spin text-primary"
      />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">{accessibleLabel}</span>}
    </div>
  );
};
