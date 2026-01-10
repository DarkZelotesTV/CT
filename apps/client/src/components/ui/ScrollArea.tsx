import type React from 'react';
import { forwardRef } from 'react';
import classNames from 'classnames';

type ScrollOrientation = 'vertical' | 'horizontal' | 'both';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  hideScrollbar?: boolean;
  orientation?: ScrollOrientation;
}

const orientationClasses: Record<ScrollOrientation, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, hideScrollbar = false, orientation = 'vertical', ...props }, ref) => (
    <div
      ref={ref}
      className={classNames(
        'scroll-area',
        orientationClasses[orientation],
        hideScrollbar && 'scroll-area--hidden',
        className
      )}
      {...props}
    />
  )
);

ScrollArea.displayName = 'ScrollArea';
