/* apps/client/src/components/modals/ModalLayout.tsx */
import { ReactNode, useEffect, useMemo } from 'react';
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

  // Topbar Integration
  useEffect(() => {
    setSlots({
      center: (
        <div className="flex items-center gap-2 text-[13px] text-gray-100">
          {topbarIcon && <span className="text-gray-300">{topbarIcon}</span>}
          <span className="font-bold">{title}</span>
        </div>
      ),
    });
    return () => setSlots({});
  }, [setSlots, title, topbarIcon]);

  if (!target) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOverlayClick?.();
      }}
    >
      {/* Verwende die .glass Klasse aus index.css
        Inline Styles für spezifisches Modal-Layout angelehnt an das Design
      */}
      <div 
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
            {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors no-drag"
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