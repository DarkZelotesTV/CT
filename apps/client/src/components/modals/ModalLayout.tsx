import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getModalRoot } from './modalRoot';
import { useTopBar } from '../window/TopBarContext';

interface ModalLayoutProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  onOverlayClick?: () => void;
}

export const ModalLayout = ({
  title,
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
        <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 max-w-[720px]">
          <div className="text-[13px] text-gray-200 truncate" title={title}>
            {title}
          </div>
        </div>
      ),
    });

    return () => {
      setSlots(base);
    };
  }, [setSlots, title]);

  if (!target) return null;

  const bodyClasses = bodyClassName ? bodyClassName : 'p-4';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOverlayClick?.();
      }}
    >
      <div className="w-[92vw] max-w-[720px] h-[86vh] max-h-[860px] rounded-2xl bg-dark-200 border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-white/10 bg-white/[0.02] flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-100 truncate">{title}</h2>
            {description && <p className="text-gray-400 mt-2 text-sm">{description}</p>}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition no-drag"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className={`${bodyClasses} overflow-y-auto custom-scrollbar min-h-0 flex-1`}>{children}</div>

        {/* Footer */}
        {footer && (
          <div className="bg-white/[0.02] p-3 text-center border-t border-white/5 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>,
    target
  );
};
