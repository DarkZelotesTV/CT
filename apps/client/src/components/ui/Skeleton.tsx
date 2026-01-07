import classNames from 'classnames';

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    aria-hidden
    className={classNames('animate-pulse rounded-md bg-[color:var(--color-surface-hover)]', className)}
  />
);
