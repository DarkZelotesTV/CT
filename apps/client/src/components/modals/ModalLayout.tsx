import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
  const bodyClasses = bodyClassName ?? 'p-6 pt-2 space-y-6';
  // SSR Safety Check
  const target = typeof document !== 'undefined' ? document.body : null;
  const handleOverlayClick = onOverlayClick ?? onClose;

  if (!target) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200 p-4 z-[200]"
      // FIX: Inline-Style für z-index erzwingt die Ebene über der Sidebar (z-50), unabhängig von Tailwind
      style={{ zIndex: 99999 }}
    >
      <div className="absolute inset-0" onClick={handleOverlayClick}></div>

      {/* Responsive Container: max-h-[90vh] und flex-col für Scrollbarkeit auf kleinen Screens */}
      <div className="bg-[#111214] w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100 relative z-10">
        
        {/* Header */}
        <div className="p-6 text-center relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          {description && <p className="text-gray-400 mt-2 text-sm">{description}</p>}
        </div>

        {/* Scrollable Body */}
        <div className={`${bodyClasses} overflow-y-auto custom-scrollbar min-h-0 flex-1`}>
            {children}
        </div>

        {/* Footer */}
        {footer && <div className="bg-white/[0.02] p-3 text-center border-t border-white/5 flex-shrink-0">{footer}</div>}
      </div>
    </div>,
    target
  );
};