import classNames from 'classnames';
import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import './DecorationLayer.css';

export const DecorationLayer = ({
  className,
  enabled = true,
}: {
  className?: string;
  enabled?: boolean;
}) => {
  const { settings } = useSettings();
  const performanceMode = settings.theme.performanceMode ?? 'auto';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.decorationPerformance = performanceMode;
    return () => {
      if (document.documentElement.dataset.decorationPerformance === performanceMode) {
        delete document.documentElement.dataset.decorationPerformance;
      }
    };
  }, [performanceMode]);

  if (!enabled) return null;

  return (
    <div
      className={classNames('decoration-layer', className)}
      data-decoration-performance={performanceMode}
      aria-hidden="true"
    >
      <div className="decoration-noise" />
      <div className="decoration-grid" />
      <div className="decoration-orb decoration-orb-primary" />
      <div className="decoration-orb decoration-orb-secondary" />
    </div>
  );
};
