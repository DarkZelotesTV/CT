import React, { createContext, forwardRef, useContext } from 'react';
import type { PopoverContentProps } from './Popover';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

interface ContextMenuContextValue {
  onOpenChange: (open: boolean) => void;
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

const useContextMenuContext = () => {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error('ContextMenu components must be used within a ContextMenu');
  }
  return ctx;
};

interface ContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const ContextMenu = ({ open, onOpenChange, children, triggerRef }: ContextMenuProps) => {
  return (
    <ContextMenuContext.Provider value={{ onOpenChange }}>
      <Popover open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
        {children}
      </Popover>
    </ContextMenuContext.Provider>
  );
};

export const ContextMenuTrigger = PopoverTrigger;

export const ContextMenuContent = forwardRef<HTMLDivElement, PopoverContentProps>(({ onKeyDown, ...rest }, ref) => {
  const { onOpenChange } = useContextMenuContext();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Tab') {
      onOpenChange(false);
    }
  };

  return <PopoverContent ref={ref} onKeyDown={handleKeyDown} {...rest} />;
});

ContextMenuContent.displayName = 'ContextMenuContent';
