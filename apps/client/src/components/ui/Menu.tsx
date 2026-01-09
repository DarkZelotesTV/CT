import { forwardRef, useEffect, useRef } from 'react';
import type React from 'react';

const menuItemSelector = '[role="menuitem"]:not([aria-disabled="true"])';

const mergeRefs = <T,>(...refs: Array<React.Ref<T> | undefined>) => {
  return (value: T) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(value);
      } else {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
};

const focusItemByIndex = (menu: HTMLElement | null, nextIndex: number) => {
  if (!menu) return;
  const items = Array.from(menu.querySelectorAll<HTMLElement>(menuItemSelector));
  if (items.length === 0) return;
  const boundedIndex = ((nextIndex % items.length) + items.length) % items.length;
  items[boundedIndex]?.focus();
};

interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  autoFocus?: boolean;
}

export const Menu = forwardRef<HTMLDivElement, MenuProps>(
  ({ autoFocus = true, onKeyDown, className, children, ...rest }, ref) => {
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!autoFocus) return;
      const node = menuRef.current;
      const firstItem = node?.querySelector<HTMLElement>(menuItemSelector);
      firstItem?.focus();
    }, [autoFocus]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const node = menuRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(menuItemSelector));
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusItemByIndex(node, currentIndex + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusItemByIndex(node, currentIndex - 1);
          break;
        case 'Home':
          event.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          event.preventDefault();
          items[items.length - 1]?.focus();
          break;
        default:
          break;
      }
    };

    return (
      <div
        role="menu"
        ref={mergeRefs(menuRef, ref)}
        className={className}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Menu.displayName = 'Menu';
