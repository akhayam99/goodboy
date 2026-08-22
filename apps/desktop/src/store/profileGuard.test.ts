import { describe, expect, it } from 'vitest';
import type { WorkspaceProfile } from '@goodboy/types';
import { buildProfileGuard } from './profileGuard';

const profile = (overrides: Partial<WorkspaceProfile> = {}): WorkspaceProfile => ({
  role: 'developer',
  discipline: 'frontend',
  topics: ['design systems', 'a11y'],
  notes: null,
  ...overrides,
});

describe('buildProfileGuard', () => {
  it('says nothing without a profile', () => {
    expect(buildProfileGuard({ profile: undefined })).toBe('');
  });

  it('says nothing when the profile is empty', () => {
    expect(
      buildProfileGuard({
        profile: { role: null, discipline: null, topics: [], notes: '   ' },
      }),
    ).toBe('');
  });

  it('describes role, discipline, and topics inside the tagged block', () => {
    const guard = buildProfileGuard({ profile: profile() });

    expect(guard.startsWith('[user-profile]')).toBe(true);
    expect(guard.endsWith('[/user-profile]')).toBe(true);
    expect(guard).toContain('role: developer');
    expect(guard).toContain('discipline: frontend');
    expect(guard).toContain('topics: design systems, a11y');
  });

  it('adds the outcome-first rule for a non-developer', () => {
    const guard = buildProfileGuard({ profile: profile({ role: 'non-developer' }) });

    expect(guard).toContain('They do not write code.');
    expect(guard).toContain('outcomes');
  });

  it('keeps diffs unrestricted for a developer', () => {
    expect(buildProfileGuard({ profile: profile() })).not.toContain('They do not write code.');
  });

  it('welcomes cross-project reasoning for the platform discipline', () => {
    const guard = buildProfileGuard({ profile: profile({ discipline: 'platform' }) });

    expect(guard).toContain('cross-project reasoning');
  });

  it('carries the notes verbatim', () => {
    const guard = buildProfileGuard({
      profile: profile({ notes: 'prefers short answers' }),
    });

    expect(guard).toContain('Notes from them: prefers short answers');
  });
});
