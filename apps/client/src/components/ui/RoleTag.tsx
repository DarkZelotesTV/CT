import * as React from 'react';
import classNames from 'classnames';
import { Pill } from './Pill';

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
  boxShadow: `0 8px 26px ${mix(accent, 24)}, var(--pill-shadow-inset)`,
});

const ROLE_STYLES: Record<RoleTagVariant, RoleStyle> = {
  admin: buildRoleStyle('var(--role-admin)'),
  mod: buildRoleStyle('var(--role-mod)'),
  bot: buildRoleStyle('var(--role-bot)'),
  neutral: {
    textColor: 'var(--color-text-secondary)',
    background: `linear-gradient(135deg, ${mix('var(--color-surface-tint)', 8)}, ${mix('var(--color-surface-tint)', 3)})`,
    borderColor: mix('var(--color-surface-tint)', 12),
    boxShadow: `0 8px 24px ${mix('var(--color-shadow)', 28)}, var(--pill-shadow-inset)`,
  },
};

export const RoleTag = ({ variant = 'neutral', className, style, ...props }: RoleTagProps) => {
  const roleStyle = ROLE_STYLES[variant] ?? ROLE_STYLES.neutral;

  return (
    <Pill
      className={classNames(
        'gap-2 font-extrabold uppercase tracking-[0.08em]',
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
