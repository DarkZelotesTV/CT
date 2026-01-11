import classNames from 'classnames';
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Icon, IconSize } from './Icon';

interface SpinnerProps {
  className?: string;
  size?: IconSize;
  label?: string;
}

export const Spinner = ({ className, size = 'md', label }: SpinnerProps) => {
  const accessibleLabel = useMemo(() => label ?? 'Loading', [label]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames('flex items-center gap-2 text-text-muted', className)}
    >
      <Icon icon={Loader2} aria-hidden size={size} className="animate-spin text-accent" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">{accessibleLabel}</span>}
    </div>
  );
};
