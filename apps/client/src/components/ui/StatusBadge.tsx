import * as React from 'react';
import classNames from 'classnames';
import { Pill } from './Pill';

export type StatusTone = 'online' | 'idle' | 'dnd' | 'offline' | 'live' | 'paused' | 'ready';
export type StatusBadgeVariant = 'pill' | 'dot';
export type StatusBadgeSize = 'sm' | 'md';

export type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  status?: StatusTone;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  withDot?: boolean;
};

type StatusToneStyle = {
  textColor: string;
  accentColor: string;
  background: string;
  borderColor: string;
  boxShadow: string;
  dotShadow: string;
};

const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

const buildTone = (accent: string, text: string = accent, shadowAccent: string = accent): StatusToneStyle => ({
  textColor: text,
  accentColor: accent,
  background: `linear-gradient(135deg, ${mix(accent, 20)}, ${mix(accent, 7)})`,
  borderColor: mix(accent, 32),
  boxShadow: `0 10px 28px ${mix(shadowAccent, 22)}, var(--pill-shadow-inset)`,
  dotShadow: `0 0 0 1px ${mix(accent, 30)}, 0 0 12px ${mix(accent, 40)}`,
});

const STATUS_TONES: Record<StatusTone, StatusToneStyle> = {
  online: buildTone('var(--status-online)'),
  idle: buildTone('var(--status-idle)'),
  dnd: buildTone('var(--status-dnd)'),
  offline: {
    textColor: 'var(--color-text-subtle)',
    accentColor: 'var(--status-offline)',
    background: `linear-gradient(135deg, ${mix('var(--color-text-muted-strong)', 15)}, ${mix('var(--color-text-muted-strong)', 5)})`,
    borderColor: mix('var(--color-text-muted-strong)', 25),
    boxShadow: `0 10px 24px ${mix('var(--color-text-muted-strong)', 18)}, var(--pill-shadow-inset)`,
    dotShadow: `0 0 0 1px ${mix('var(--status-offline)', 30)}, 0 0 10px ${mix('var(--status-offline)', 35)}`,
  },
  live: buildTone('var(--color-text-danger)'),
  paused: buildTone('var(--color-text-warning)'),
  ready: buildTone('var(--color-text-success)'),
};

const getTone = (status?: StatusTone) => STATUS_TONES[status ?? 'offline'] ?? STATUS_TONES.offline;

export const StatusBadge = ({
  status = 'offline',
  variant = 'pill',
  size = 'sm',
  withDot = false,
  className,
  children,
  style,
  ...props
}: StatusBadgeProps) => {
  const tone = getTone(status);
  const dotSizeClass = size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5';

  if (variant === 'dot') {
    return (
      <span
        className={classNames('inline-flex shrink-0 rounded-full border-2 border-[color:var(--color-surface)]', dotSizeClass, className)}
        style={{
          background: tone.accentColor,
          boxShadow: tone.dotShadow,
          ...style,
        }}
        {...props}
      />
    );
  }

  return (
    <Pill
      size={size}
      className={classNames('gap-2 font-extrabold uppercase tracking-[0.08em]', className)}
      style={{
        color: tone.textColor,
        background: tone.background,
        borderColor: tone.borderColor,
        boxShadow: tone.boxShadow,
        backdropFilter: 'blur(10px)',
        ...style,
      }}
      {...props}
    >
      {withDot && (
        <span
          className={classNames('inline-flex shrink-0 rounded-full', dotSizeClass)}
          style={{
            background: tone.accentColor,
            boxShadow: `0 0 8px ${mix(tone.accentColor, 45)}`,
          }}
        />
      )}
      {children}
    </Pill>
  );
};
