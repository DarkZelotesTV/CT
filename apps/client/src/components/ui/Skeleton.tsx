import classNames from 'classnames';

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    aria-hidden
    className={classNames('animate-pulse rounded-md bg-white/5', className)}
  />
);
