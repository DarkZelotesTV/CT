import type { LucideIcon, LucideProps } from 'lucide-react';
import classNames from 'classnames';

const sizePresets = {
  sm: 14,
  md: 16,
  lg: 20,
} as const;

type IconSize = keyof typeof sizePresets;
type HoverTone = 'text' | 'accent' | 'none';

interface IconProps extends Omit<LucideProps, 'size'> {
  icon: LucideIcon;
  size?: IconSize;
  hoverTone?: HoverTone;
}

export const Icon = ({ icon: IconComponent, size = 'md', hoverTone = 'text', className, ...props }: IconProps) => {
  const hoverClass = hoverTone === 'accent'
    ? 'hover:text-accent group-hover:text-accent'
    : hoverTone === 'text'
      ? 'hover:text-text group-hover:text-text'
      : '';

  return (
    <IconComponent
      size={sizePresets[size]}
      className={classNames('text-text-muted transition-colors', hoverClass, className)}
      {...props}
    />
  );
};
