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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[color:var(--color-surface)]/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOverlayClick?.();
      }}
    >
      {/* Verwende die .glass Klasse aus index.css
        Inline Styles für spezifisches Modal-Layout angelehnt an das Design
      */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="glass flex flex-col max-h-[85vh] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ 
          borderRadius: '16px', 
          border: 'var(--border-shine)',
          background: 'rgba(22, 22, 25, 0.65)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.08)]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
            {description && <p className="text-sm text-[color:var(--color-text-muted)] mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[color:var(--color-text-muted)] hover:text-white hover:bg-[color:var(--color-surface-hover)]/80 rounded-lg transition-colors no-drag"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={`p-5 overflow-y-auto custom-scrollbar ${bodyClassName ?? ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-[rgba(0,0,0,0.2)] border-t border-[rgba(255,255,255,0.08)] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    target
  );
};
