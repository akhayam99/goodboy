import { describe, expect, it } from 'vitest';
import { buildProfileGuard } from './profileGuard';

describe('buildProfileGuard', () => {
  it('says nothing without a profile', () => {
    expect(buildProfileGuard({ profile: undefined })).toBe('');
  });

  it('says nothing when the bio is empty or whitespace', () => {
    expect(buildProfileGuard({ profile: { bio: null } })).toBe('');
    expect(buildProfileGuard({ profile: { bio: '   ' } })).toBe('');
  });

  it('frames the bio verbatim inside the tagged block', () => {
    const guard = buildProfileGuard({
      profile: { bio: 'I lead design for the checkout team. Explain changes as outcomes.' },
    });

    expect(guard).toBe(
      [
        '[user-profile]',
        'The person you are working with says:',
        'I lead design for the checkout team. Explain changes as outcomes.',
        '[/user-profile]',
      ].join('\n'),
    );
  });

  it('trims surrounding whitespace but keeps inner formatting', () => {
    const guard = buildProfileGuard({ profile: { bio: '  line one\nline two  ' } });

    expect(guard).toContain('line one\nline two');
    expect(guard.startsWith('[user-profile]')).toBe(true);
    expect(guard.endsWith('[/user-profile]')).toBe(true);
  });
});
