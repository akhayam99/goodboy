import { describe, expect, it } from 'vitest';
import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import { resolveItemActions, type ResolveItemActionId } from './resolveItemActions';

const DECISIONS: ReadonlySet<ResolveItemActionId> = new Set([
  'fix_it',
  'discuss',
  'close',
  'resolve',
]);

const EXPECTED: Record<ResolveQueueStatus, ResolveItemActionId | null> = {
  fix_ready: 'resolve',
  reply_ready: 'resolve',
  no_change: 'fix_it',
  agent_asked: 'fix_it',
  working: 'view_agent',
  ready_to_push: 'resolve',
  pushed: 'open_github',
  later: 'resume_comment',
  changed_since_accepted: 'review_changed',
  delivery_failed: 'resolve',
  confirm_delivery: 'open_github',
  run_failed: 'fix_it',
  run_stopped: 'fix_it',
  wont_fix: 'resolve',
  wont_fix_sent: 'open_github',
};

const build = (patch: Partial<Parameters<typeof resolveItemActions>[0]> = {}) =>
  resolveItemActions({
    status: 'fix_ready',
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
    [ResolveQueueStatus, ResolveItemActionId | null]
  >) {
    it(`offers one primary on ${status}`, () => {
      const result = build({ status });

      expect(result.primary?.id ?? null).toBe(primary);
      expect(result.secondary === null || result.secondary.id !== result.primary?.id).toBe(true);
    });
  }

  it('speaks only the four verbs plus the ways out', () => {
    for (const status of Object.keys(EXPECTED) as ReadonlyArray<ResolveQueueStatus>) {
      const result = build({ status });
      const ids = [result.primary, result.secondary, ...result.overflow].flatMap((entry) =>
        entry === null ? [] : [entry.id],
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length - ids.filter((id) => DECISIONS.has(id)).length).toBeLessThanOrEqual(2);
      expect(ids.filter((id) => DECISIONS.has(id)).length).toBeLessThanOrEqual(DECISIONS.size);
    }
  });

  it('names the whole group when one decision settles several comments', () => {
    expect(build({ sharedApprovalCount: 3 }).primary?.label).toBe('Resolve 3 comments');
  });

  it('asks the agent to answer its own question first', () => {
    const result = build({ status: 'agent_asked', hasQuestion: true });

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
