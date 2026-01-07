import classNames from 'classnames';
import './DecorationLayer.css';

export const DecorationLayer = ({
  className,
  enabled = true,
}: {
  className?: string;
  enabled?: boolean;
}) => {
  if (!enabled) return null;

  return (
    <div className={classNames('decoration-layer', className)} aria-hidden="true">
      <div className="decoration-noise" />
      <div className="decoration-grid" />
      <div className="decoration-orb decoration-orb-primary" />
      <div className="decoration-orb decoration-orb-secondary" />
    </div>
  );
};
