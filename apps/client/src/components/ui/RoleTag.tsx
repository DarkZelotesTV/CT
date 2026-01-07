import * as React from 'react';
import classNames from 'classnames';

export type RoleTagVariant = 'admin' | 'mod' | 'bot' | 'neutral';

export type RoleTagProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: RoleTagVariant;
};

type RoleStyle = {
  textColor: string;
  background: string;
  borderColor: string;
  boxShadow: string;
};

const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`;

const buildRoleStyle = (accent: string, text: string = accent): RoleStyle => ({
  textColor: text,
  background: `linear-gradient(135deg, ${mix(accent, 18)}, ${mix(accent, 6)})`,
  borderColor: mix(accent, 28),
  boxShadow: `0 8px 26px ${mix(accent, 24)}, inset 0 1px 0 ${mix('var(--color-surface-tint)', 8)}`,
});

const ROLE_STYLES: Record<RoleTagVariant, RoleStyle> = {
  admin: buildRoleStyle('var(--role-admin)'),
  mod: buildRoleStyle('var(--role-mod)'),
  bot: buildRoleStyle('var(--role-bot)'),
  neutral: {
    textColor: 'var(--color-text-secondary)',
    background: `linear-gradient(135deg, ${mix('var(--color-surface-tint)', 8)}, ${mix('var(--color-surface-tint)', 3)})`,
    borderColor: mix('var(--color-surface-tint)', 12),
    boxShadow: `0 8px 24px ${mix('var(--color-shadow)', 28)}, inset 0 1px 0 ${mix('var(--color-surface-tint)', 8)}`,
  },
};

export const RoleTag = ({ variant = 'neutral', className, style, ...props }: RoleTagProps) => {
  const roleStyle = ROLE_STYLES[variant] ?? ROLE_STYLES.neutral;

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-2 rounded-[var(--radius-pill)] border',
        'px-3 py-1 text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] font-extrabold uppercase tracking-[0.08em]',
        className,
      )}
      style={{
        color: roleStyle.textColor,
        background: roleStyle.background,
        borderColor: roleStyle.borderColor,
        boxShadow: roleStyle.boxShadow,
        backdropFilter: 'blur(12px)',
        ...style,
      }}
      {...props}
    />
  );
};
