import { forwardRef } from 'react';
import type React from 'react';

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const MenuItem = forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ className, type = 'button', ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        role="menuitem"
        data-menu-item
        tabIndex={-1}
        className={className}
        {...rest}
      />
    );
  }
);

MenuItem.displayName = 'MenuItem';
