import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { getAvatarUrl, MemberAvatar, normalizeMemberData, type Member } from './MemberSidebar';

describe('getAvatarUrl', () => {
  it('returns legacy URLs directly', () => {
    expect(getAvatarUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png');
    expect(getAvatarUrl({ url: 'https://example.com/from-object.png' })).toBe('https://example.com/from-object.png');
  });

  it('resolves nested image variants', () => {
    const payload = {
      avatar: {
        imageVariants: {
          thumb: 'https://example.com/thumb.png',
          default: { url: 'https://example.com/default.png' },
        },
      },
    };

    expect(getAvatarUrl(payload)).toBe('https://example.com/default.png');
  });

  it('supports CDN keys as URLs', () => {
    const payload = { avatar: { cdnKey: 'https://cdn.example.com/avatar-key' } };
    expect(getAvatarUrl(payload)).toBe('https://cdn.example.com/avatar-key');
  });
});

describe('normalizeMemberData', () => {
  const unknown = 'Unknown User';

  it('maps mixed payloads and extracts avatar', () => {
    const payload = {
      user_id: 42,
      user: { username: 'NestedUser' },
      avatar: {
        variants: {
          full: { url: 'https://example.com/full.png' },
        },
      },
      status: 'online',
      role: { name: 'owner' },
    };

    const member = normalizeMemberData(payload, unknown);
    expect(member).toMatchObject({
      userId: 42,
      username: 'NestedUser',
      avatarUrl: 'https://example.com/full.png',
      status: 'online',
    });
  });

  it('falls back to provided unknown username and omits avatarUrl when none found', () => {
    const payload = { userId: 7, status: 'offline' };
    const member = normalizeMemberData(payload, unknown);

    expect(member.username).toBe(unknown);
    expect(member.avatarUrl).toBeUndefined();
    expect(member.status).toBe('offline');
  });
});

describe('MemberAvatar', () => {
  const baseMember: Member = { userId: 1, username: 'Alice', status: 'online' };

  it('renders image when avatarUrl exists and keeps status badge overlayed', () => {
    const member = { ...baseMember, avatarUrl: 'https://example.com/avatar.png' };

    render(
      <MemberAvatar
        member={member}
        avatarAlt="Alice avatar"
        initialsLabel="Initials"
        statusLabel={(status) => `Status: ${status}`}
      />
    );

    const avatarImg = screen.getByAltText('Alice avatar');
    expect(avatarImg).toHaveAttribute('src', member.avatarUrl);
    expect(screen.getByLabelText('Status: online')).toHaveClass('absolute');
  });

  it('falls back to initials when avatar is missing', () => {
    render(
      <MemberAvatar
        member={baseMember}
        avatarAlt="Alice avatar"
        initialsLabel="Initials"
        statusLabel={(status) => `Status: ${status}`}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByLabelText('Initials')).toBeInTheDocument();
    expect(screen.getByLabelText('Status: online')).toBeInTheDocument();
  });
});
