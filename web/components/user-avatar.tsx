'use client';

import { useState } from 'react';

type UserAvatarProps = {
  className?: string;
  displayName: string;
  email?: string;
  size?: 'compact' | 'medium' | 'large';
  sources: string[];
};

function initials(displayName: string, email?: string) {
  return (displayName || email || '?')
    .split(/[\s@]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function UserAvatar({ className = '', displayName, email, size = 'medium', sources }: UserAvatarProps) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const source = sources.find((candidate) => !failedSources.includes(candidate)) ?? null;
  const label = `${displayName || 'Card Nest user'} profile photo`;

  return (
    <span
      aria-label={source ? undefined : label}
      className={`user-avatar user-avatar-${size} ${className}`.trim()}
      role={source ? undefined : 'img'}>
      <span aria-hidden>{initials(displayName, email)}</span>
      {source ? (
        // Profile images include a private same-origin endpoint and allowlisted provider
        // fallbacks, so the browser must fetch them directly rather than Next's optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={label}
          decoding="async"
          onError={() => setFailedSources((current) => source && !current.includes(source) ? [...current, source] : current)}
          referrerPolicy="no-referrer"
          src={source}
        />
      ) : null}
    </span>
  );
}
