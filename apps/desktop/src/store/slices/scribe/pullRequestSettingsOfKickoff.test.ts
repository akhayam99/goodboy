// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pullRequestSettingsOfKickoff } from './pullRequestSettingsOfKickoff';
import { scribeKickoff } from './scribeKickoff';

const kickoffOf = ({ isDraft, baseBranch }: { isDraft: boolean; baseBranch: string }) =>
  scribeKickoff({
    task: { kind: 'pr', closedPrNumber: null, references: [], isDraft, base: null },
    branch: 'fix/ledger-postings',
    baseBranch,
    goal: 'Stop double postings in ledger-core',
    decisions: '',
    summary: '',
    issues: [],
  });

describe('pullRequestSettingsOfKickoff', () => {
  it('reads a draft aimed at the default base', () => {
    expect(
      pullRequestSettingsOfKickoff({ kickoff: kickoffOf({ isDraft: true, baseBranch: 'main' }) }),
    ).toEqual({ isDraft: true, base: 'main' });
  });

  it('reads a ready request aimed at a custom base with dots in its name', () => {
    expect(
      pullRequestSettingsOfKickoff({
        kickoff: kickoffOf({ isDraft: false, baseBranch: 'release/0.19' }),
      }),
    ).toEqual({ isDraft: false, base: 'release/0.19' });
  });

  it('reads a draft aimed at a custom base', () => {
    expect(
      pullRequestSettingsOfKickoff({
        kickoff: kickoffOf({ isDraft: true, baseBranch: 'release/0.19' }),
      }),
    ).toEqual({ isDraft: true, base: 'release/0.19' });
  });

  it('falls back to a draft on the default base when the kickoff is missing or unreadable', () => {
    expect(pullRequestSettingsOfKickoff({ kickoff: null })).toEqual({ isDraft: true, base: null });
    expect(pullRequestSettingsOfKickoff({ kickoff: 'Write something else' })).toEqual({
      isDraft: true,
      base: null,
    });
  });
});
