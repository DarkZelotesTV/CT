import type { LucideIcon, LucideProps } from 'lucide-react';
import classNames from 'classnames';

const sizePresets = {
  sm: 14,
  md: 16,
  lg: 20,
} as const;

type IconSize = keyof typeof sizePresets;
type IconTone = 'muted' | 'default' | 'accent';
type HoverTone = 'text' | IconTone | 'none';

interface IconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: IconSize | number;
  tone?: IconTone;
  hoverTone?: HoverTone;
}

const toneClasses: Record<IconTone, string> = {
  muted: 'text-text-muted',
  default: 'text-text',
  accent: 'text-accent',
};

const hoverToneClasses: Record<Exclude<HoverTone, 'none'>, string> = {
  text: 'hover:text-text group-hover:text-text',
  muted: 'hover:text-text-muted group-hover:text-text-muted',
  default: 'hover:text-text group-hover:text-text',
  accent: 'hover:text-accent group-hover:text-accent',
};

export const Icon = ({
  icon: IconComponent,
  size = 'md',
  tone = 'muted',
  hoverTone = 'text',
  className,
  ...props
}: IconProps) => {
  const resolvedSize = typeof size === 'number' ? size : sizePresets[size];
  const hoverClass = hoverTone === 'none' ? '' : hoverToneClasses[hoverTone];

  return (
    <IconComponent
      size={resolvedSize}
      className={classNames('transition-colors', toneClasses[tone], hoverClass, className)}
      {...props}
    />
  );
};
