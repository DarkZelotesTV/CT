import * as React from 'react';
import classNames from 'classnames';
import './Avatar.css';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded' | 'square' | 'inherit';
export type AvatarStatus = 'online' | 'idle' | 'dnd' | 'offline';

export type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: AvatarSize;
  shape?: AvatarShape;
  status?: AvatarStatus;
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
};

export const Avatar = ({
  size = 'md',
  shape = 'rounded',
  status,
  src,
  alt,
  fallback,
  className,
  ...props
}: AvatarProps) => {
  const fallbackContent = fallback ?? (alt?.[0] ? alt[0].toUpperCase() : '?');

  return (
    <div
      className={classNames(
        'ct-avatar',
        `ct-avatar--size-${size}`,
        `ct-avatar--shape-${shape}`,
        className
      )}
      {...props}
    >
      {status && (
        <span className={classNames('ct-avatar__status-ring', `ct-avatar__status-ring--${status}`)} aria-hidden />
      )}
      {src ? (
        <img src={src} alt={alt ?? ''} />
      ) : (
        <span className="ct-avatar__fallback" aria-hidden={Boolean(alt)}>
          {fallbackContent}
        </span>
      )}
    </div>
  );
};
