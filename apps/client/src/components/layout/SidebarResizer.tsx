import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

type SidebarResizerProps = {
  side: 'left' | 'right';
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
  onReset: () => void;
};

const step = 16;

export const SidebarResizer = ({ side, value, min, max, onChange, onReset }: SidebarResizerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragStateRef = useRef<{ startX: number; startValue: number }>({ startX: 0, startValue: value });

  const clampValue = useCallback(
    (nextValue: number) => Math.min(Math.max(nextValue, min), max),
    [max, min]
  );

  const stopDragging = useCallback(() => {
    setIsDragging(false);
    pointerIdRef.current = null;
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    dragStateRef.current = { startX: event.clientX, startValue: value };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isDragging || pointerIdRef.current !== event.pointerId) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const direction = side === 'left' ? 1 : -1;
      const nextValue = clampValue(dragStateRef.current.startValue + delta * direction);
      onChange(nextValue);
    },
    [clampValue, isDragging, onChange, side]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      if (pointerIdRef.current !== event.pointerId) return;
      stopDragging();
    },
    [stopDragging]
  );

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    document.body.classList.add('select-none');
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.classList.remove('select-none');
    };
  }, [handlePointerMove, handlePointerUp, isDragging]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = side === 'left' ? 1 : -1;
    const delta = (event.key === 'ArrowRight' ? step : -step) * direction;
    onChange(clampValue(value + delta));
  };

  return (
    <div
      className={classNames(
        'absolute top-0 h-full w-1 cursor-col-resize z-20 hover:bg-[color:var(--color-surface-hover)]/80 touch-none',
        side === 'left' ? 'right-0' : 'left-0'
      )}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    />
  );
};
