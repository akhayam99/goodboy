import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceProfile } from './normalizeWorkspaceProfile';

describe('normalizeWorkspaceProfile', () => {
  it('reads a missing profile as an empty one', () => {
    expect(normalizeWorkspaceProfile({ profile: undefined })).toEqual({
      roles: [],
      aboutWork: null,
      workingRules: null,
      explainMore: [],
    });
  });

  it('trims text, drops blank and repeated labels, and keeps the first spelling', () => {
    expect(
      normalizeWorkspaceProfile({
        profile: {
          roles: [' Tech Lead ', 'tech lead', '', 'Backend  Engineer'],
          aboutWork: '  Leads the payments platform team.  ',
          workingRules: '   ',
          explainMore: ['Rust', 'rust', ' Kubernetes'],
        },
      }),
    ).toEqual({
      roles: ['Tech Lead', 'Backend Engineer'],
      aboutWork: 'Leads the payments platform team.',
      workingRules: null,
      explainMore: ['Rust', 'Kubernetes'],
    });
  });
});
