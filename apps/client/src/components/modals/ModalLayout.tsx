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
  const { slots, setSlots } = useTopBar();
  const baseSlotsRef = useRef(slots);

  // Wenn ein Modal offen ist: Titlebar-Center auf den Modal-Titel setzen (Desktop).
  useEffect(() => {
    const base = baseSlotsRef.current;
    setSlots({
      ...base,
      center: (
        <div className="flex items-center gap-2 text-[13px] text-gray-100 leading-tight min-w-0">
          {topbarIcon ? <span className="text-gray-300">{topbarIcon}</span> : null}
          <span className="truncate" title={title}>
            {title}
          </span>
        </div>
      ),
    });

    return () => {
      setSlots(base);
    };
  }, [setSlots, title, topbarIcon]);

  if (!target) return null;

  const bodyClasses = bodyClassName ?? '';

  return createPortal(
    <div
      className="ct-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOverlayClick?.();
      }}
    >
      <div className="ct-modal glass">
        {/* Header */}
        <div className="ct-modal-header">
          <div className="min-w-0">
            <h2 className="ct-modal-title">{title}</h2>
            {description && <p className="ct-modal-desc">{description}</p>}
          </div>

          <button
            onClick={onClose}
            className="ct-modal-close no-drag"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className={`ct-modal-body ${bodyClasses} custom-scrollbar`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="ct-modal-footer">{footer}</div>
        )}
      </div>
    </div>,
    target
  );
};
