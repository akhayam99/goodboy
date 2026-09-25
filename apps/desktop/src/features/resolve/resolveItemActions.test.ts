import { describe, expect, it } from 'vitest';
import type { ResolveUiState } from './resolveRowState';
import { resolveItemActions, type ResolveItemActionId } from './resolveItemActions';

const DECISIONS: ReadonlySet<ResolveItemActionId> = new Set([
  'fix_it',
  'discuss',
  'close',
  'resolve',
]);

const EXPECTED: Record<ResolveUiState, ResolveItemActionId | null> = {
  new: 'fix_it',
  ready: 'resolve',
  needs_you: 'fix_it',
  working: 'view_agent',
  approved: 'resolve',
  resolved: 'open_github',
  later: 'resume_comment',
  failed: 'fix_it',
};

const build = (patch: Partial<Parameters<typeof resolveItemActions>[0]> = {}) =>
  resolveItemActions({
    status: 'ready',
    proposalKind: 'fix',
    failedStep: null,
    sharedApprovalCount: 1,
    resolveBlockedReason: null,
    closeBlockedReason: null,
    hasQuestion: false,
    hasAgent: true,
    hasGithubUrl: true,
    canStopRun: true,
    isEditing: false,
    isBusy: false,
    ...patch,
  });

describe('the actions a comment offers', () => {
  for (const [status, primary] of Object.entries(EXPECTED) as ReadonlyArray<
    [ResolveUiState, ResolveItemActionId | null]
  >) {
    it(`offers one primary on ${status}`, () => {
      const result = build({ status });

      expect(result.primary?.id ?? null).toBe(primary);
      expect(result.secondary === null || result.secondary.id !== result.primary?.id).toBe(true);
    });
  }

  it('speaks only the four verbs plus the ways out', () => {
    for (const status of Object.keys(EXPECTED) as ReadonlyArray<ResolveUiState>) {
      const result = build({ status });
      const ids = [result.primary, result.secondary, ...result.overflow].flatMap((entry) =>
        entry === null ? [] : [entry.id],
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length - ids.filter((id) => DECISIONS.has(id)).length).toBeLessThanOrEqual(2);
      expect(ids.filter((id) => DECISIONS.has(id)).length).toBeLessThanOrEqual(DECISIONS.size);
    }
  });

  it('retries the step that failed, and sends an unsure reply to GitHub first', () => {
    expect(build({ status: 'failed', failedStep: 'reply' }).primary?.id).toBe('resolve');
    expect(build({ status: 'failed', failedStep: 'uncertain' }).primary?.id).toBe('open_github');
    expect(build({ status: 'ready', proposalKind: 'none' }).primary?.id).toBe('fix_it');
  });

  it('names the whole group when one decision settles several comments', () => {
    expect(build({ sharedApprovalCount: 3 }).primary?.label).toBe('Resolve 3 comments');
  });

  it('asks the agent to answer its own question first', () => {
    const result = build({ status: 'needs_you', hasQuestion: true });

    expect(result.primary?.label).toBe('Answer the agent');
  });

  it('keeps closing away from a comment whose fix already landed', () => {
    const result = build({ closeBlockedReason: 'Fix already integrated' });

    expect(result.overflow.some((action) => action.id === 'close')).toBe(false);
  });

  it('carries the reason a decision cannot be taken', () => {
    const result = build({ resolveBlockedReason: 'The run has to stop first' });

    expect(result.primary?.disabledReason).toBe('The run has to stop first');
  });

  it('removes header decisions while an editor is open', () => {
    expect(build({ isEditing: true })).toEqual({ primary: null, secondary: null, overflow: [] });
  });
});
