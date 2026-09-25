import { describe, expect, it } from 'vitest';
import type { WorkspaceProfile } from '@goodboy/types';
import { buildProfileGuard } from './profileGuard';

const FULL: WorkspaceProfile = {
  roles: ['Tech Lead', 'Backend Engineer'],
  aboutWork: 'Leads the payments platform team. Owns the ledger schema.',
  workingRules: 'Ask before touching migrations. Keep pull requests small.',
  explainMore: ['Rust', 'Kubernetes'],
};

const EMPTY: WorkspaceProfile = { roles: [], aboutWork: null, workingRules: null, explainMore: [] };

describe('buildProfileGuard', () => {
  it('says nothing without a profile', () => {
    expect(buildProfileGuard({ profile: undefined, audience: 'custom' })).toBe('');
  });

  it('says nothing when every field is empty or whitespace', () => {
    expect(buildProfileGuard({ profile: EMPTY, audience: 'custom' })).toBe('');
    expect(
      buildProfileGuard({
        profile: { ...EMPTY, roles: ['  '], aboutWork: '   ', workingRules: ' ' },
        audience: 'custom',
      }),
    ).toBe('');
  });

  it('gives a custom agent every field in a fixed order', () => {
    expect(buildProfileGuard({ profile: FULL, audience: 'custom' })).toBe(
      [
        '[user-profile]',
        'The person you are working with:',
        'Their roles: Tech Lead, Backend Engineer',
        'About their work:',
        'Leads the payments platform team. Owns the ledger schema.',
        'How they want agents to work with them:',
        'Ask before touching migrations. Keep pull requests small.',
        'Explain more when the work touches: Rust, Kubernetes',
        '[/user-profile]',
      ].join('\n'),
    );
  });

  it('gives an implementer the roles and the working rules only', () => {
    const guard = buildProfileGuard({ profile: FULL, audience: 'implementer' });
    expect(guard).toContain('Their roles: Tech Lead, Backend Engineer');
    expect(guard).toContain('Ask before touching migrations.');
    expect(guard).not.toContain('Leads the payments platform team');
    expect(guard).not.toContain('Rust');
  });

  it('gives a scout the work and the topics but not the working rules', () => {
    const guard = buildProfileGuard({ profile: FULL, audience: 'scout' });
    expect(guard).toContain('Leads the payments platform team');
    expect(guard).toContain('Explain more when the work touches: Rust, Kubernetes');
    expect(guard).not.toContain('Ask before touching migrations.');
  });

  it('gives the orchestrator, the planner and a question delegate no topics', () => {
    for (const audience of ['orchestrator', 'planner', 'questionDelegate'] as const) {
      const guard = buildProfileGuard({ profile: FULL, audience });
      expect(guard).toContain('Leads the payments platform team');
      expect(guard).toContain('Ask before touching migrations.');
      expect(guard).not.toContain('Rust');
    }
  });

  it('says nothing to a role whose fields are all empty', () => {
    expect(
      buildProfileGuard({
        profile: { ...EMPTY, aboutWork: 'Leads the payments platform team.' },
        audience: 'implementer',
      }),
    ).toBe('');
  });

  it('trims surrounding whitespace but keeps inner line breaks', () => {
    const guard = buildProfileGuard({
      profile: { ...EMPTY, aboutWork: '  line one\nline two  ' },
      audience: 'planner',
    });
    expect(guard).toContain('About their work:\nline one\nline two\n[/user-profile]');
  });
});
