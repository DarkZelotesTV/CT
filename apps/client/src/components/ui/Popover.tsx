import React, { createContext, forwardRef, useContext, useEffect, useId, useRef } from 'react';

const focusableSelector =
  '[data-menu-item],[role="menuitem"],button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

type NullableElement = HTMLElement | null;

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

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<NullableElement>;
  contentRef: React.RefObject<NullableElement>;
  contentId: string;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

const usePopoverContext = () => {
  const ctx = useContext(PopoverContext);
  if (!ctx) {
    throw new Error('Popover components must be used within a Popover');
  }
  return ctx;
};

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  triggerRef?: React.RefObject<NullableElement>;
}

export const Popover = ({ open, onOpenChange, children, triggerRef }: PopoverProps) => {
  const internalTriggerRef = useRef<NullableElement>(null);
  const contentRef = useRef<NullableElement>(null);
  const resolvedTriggerRef = triggerRef ?? internalTriggerRef;
  const contentId = useId();
  const previousFocusRef = useRef<NullableElement>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as NullableElement;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (contentRef.current?.contains(target)) return;
      if (resolvedTriggerRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [onOpenChange, open, resolvedTriggerRef]);

  useEffect(() => {
    if (open) return;
    const target = resolvedTriggerRef.current ?? previousFocusRef.current;
    target?.focus?.();
  }, [open, resolvedTriggerRef]);

  return (
    <PopoverContext.Provider
      value={{
        open,
        onOpenChange,
        triggerRef: resolvedTriggerRef,
        contentRef,
        contentId,
      }}
    >
      {children}
    </PopoverContext.Provider>
  );
};

interface PopoverTriggerProps {
  children: React.ReactElement;
  onClick?: React.MouseEventHandler;
  onKeyDown?: React.KeyboardEventHandler;
}

export const PopoverTrigger = forwardRef<HTMLElement, PopoverTriggerProps>(({ children, onClick, onKeyDown }, ref) => {
  const { open, onOpenChange, triggerRef, contentId } = usePopoverContext();
  const childProps = children.props ?? {};

  return React.cloneElement(children, {
    ref: mergeRefs(triggerRef as React.Ref<HTMLElement>, ref, childProps.ref),
    'aria-haspopup': childProps['aria-haspopup'] ?? 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? contentId : undefined,
    onClick: (event: React.MouseEvent) => {
      childProps.onClick?.(event);
      onClick?.(event);
      if (event.defaultPrevented) return;
      onOpenChange(!open);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      childProps.onKeyDown?.(event);
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpenChange(true);
      }
    },
  });
});

PopoverTrigger.displayName = 'PopoverTrigger';

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  initialFocusRef?: React.RefObject<HTMLElement>;
  autoFocus?: boolean;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, style, children, initialFocusRef, autoFocus = true, ...rest }, ref) => {
    const { open, contentRef, contentId } = usePopoverContext();

    useEffect(() => {
      if (!open) return;
      const focusTarget = initialFocusRef?.current;
      if (focusTarget) {
        focusTarget.focus();
        return;
      }
      if (!autoFocus) return;
      const node = contentRef.current;
      const firstFocusable = node?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    }, [autoFocus, contentRef, initialFocusRef, open]);

    if (!open) return null;

    return (
      <div
        ref={mergeRefs(contentRef, ref)}
        id={contentId}
        className={className}
        style={style}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

PopoverContent.displayName = 'PopoverContent';
