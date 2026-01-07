/* apps/client/src/components/modals/ModalLayout.tsx */
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getModalRoot } from './modalRoot';
import { useTopBar } from '../window/TopBarContext';

interface ModalLayoutProps {
  title: string;
  topbarIcon?: ReactNode;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  onOverlayClick?: () => void;
}

export const ModalLayout = ({
  title,
  topbarIcon,
  description,
  onClose,
  children,
  footer,
  bodyClassName,
  onOverlayClick,
}: ModalLayoutProps) => {
  const target = useMemo(getModalRoot, []);
  const { setSlots } = useTopBar();
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Topbar Integration
  useEffect(() => {
    setSlots({
      center: (
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-text)]">
          {topbarIcon && <span className="text-[color:var(--color-text)]">{topbarIcon}</span>}
          <span className="font-bold">{title}</span>
        </div>
      ),
    });
    return () => setSlots({});
  }, [setSlots, title, topbarIcon]);

  useEffect(() => {
    if (!target) return undefined;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const modalElement = modalRef.current;

    const getFocusableElements = () => {
      if (!modalElement) return [];
      return Array.from(
        modalElement.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
        )
      ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
    };

    const focusInitialElement = () => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else if (modalElement) {
        modalElement.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modalElement) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        modalElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!modalElement.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && (activeElement === firstElement || activeElement === modalElement)) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    focusInitialElement();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose, target]);

  if (!target) return null;

  return createPortal(
    <div
      className="ct-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOverlayClick?.();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="ct-modal glass animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="ct-modal-header">
          <div>
            <h2 className="ct-modal-title">{title}</h2>
            {description && <p className="ct-modal-desc">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="ct-modal-close no-drag"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={`ct-modal-body custom-scrollbar ${bodyClassName ?? ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="ct-modal-footer flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    target
  );
};
