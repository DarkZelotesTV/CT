import * as React from 'react';
import classNames from 'classnames';

export type PillSize = 'sm' | 'md';

export type PillProps = React.HTMLAttributes<HTMLSpanElement> & {
  size?: PillSize;
};

export const Pill = ({ size = 'sm', className, style, ...props }: PillProps) => {
  const sizeClassName =
    size === 'md'
      ? 'min-h-[var(--pill-height-md)] px-[var(--pill-padding-x-md)] py-[var(--pill-padding-y-md)]'
      : 'min-h-[var(--pill-height-sm)] px-[var(--pill-padding-x-sm)] py-[var(--pill-padding-y-sm)]';

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-[var(--radius-pill)] border',
        'text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)]',
        sizeClassName,
        className,
      )}
      style={{ borderWidth: 'var(--pill-border-width)', ...style }}
      {...props}
    />
  );
};
