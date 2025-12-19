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
  const target = typeof document !== 'undefined' ? document.body : null;
  const handleOverlayClick = onOverlayClick ?? onClose;

  if (!target) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-200 p-4`}>
      <div className="absolute inset-0" onClick={handleOverlayClick}></div>

      <div className="bg-[#111214] w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100 relative z-10">
        <div className="p-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          {description && <p className="text-gray-400 mt-2 text-sm">{description}</p>}
        </div>

        <div className={bodyClasses}>{children}</div>

        {footer && <div className="bg-white/[0.02] p-3 text-center border-t border-white/5">{footer}</div>}
      </div>
    </div>,
    target
  );
};
