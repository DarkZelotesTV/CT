import classNames from 'classnames';

interface SkeletonProps {
  className?: string;
}

interface SkeletonPatternProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    aria-hidden
    className={classNames('animate-pulse rounded-md bg-surface-hover', className)}
  />
);

export const SkeletonRailItem = ({ className }: SkeletonPatternProps) => (
  <div className={classNames('flex w-full justify-center', className)}>
    <Skeleton className="h-12 w-12 rounded-full" />
  </div>
);

export const SkeletonChannelRow = ({ className }: SkeletonPatternProps) => (
  <div className={classNames('ct-channel-sidebar__channel', className)}>
    <Skeleton className="h-5 w-5 rounded-md" />
    <div className="ct-channel-sidebar__channel-meta">
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-2.5 w-2/5" />
    </div>
  </div>
);

export const SkeletonMemberRow = ({ className }: SkeletonPatternProps) => (
  <div className={classNames('ct-member-sidebar__row', className)}>
    <Skeleton className="h-[46px] w-[46px] rounded-[var(--radius-3)]" />
    <div className="ct-member-sidebar__body">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-2.5 w-1/2" />
    </div>
  </div>
);
