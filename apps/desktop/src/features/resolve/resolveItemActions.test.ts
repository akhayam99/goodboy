import { describe, expect, it } from 'vitest';
import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import { resolveItemActions } from './resolveItemActions';

const EXPECTED: Record<ResolveQueueStatus, string | null> = {
  fix_ready: 'approve',
  reply_ready: 'approve',
  no_change: 'start_agent',
  agent_asked: 'answer_agent',
  working: 'view_agent',
  ready_to_push: 'review_publication',
  pushed: 'open_github',
  later: 'resume_comment',
  changed_since_accepted: 'review_changed',
  delivery_failed: 'review_publication',
  confirm_delivery: 'open_github',
  run_failed: 'retry_agent',
  run_stopped: 'restart_agent',
  wont_fix: 'review_publication',
  wont_fix_sent: 'open_github',
};

describe('resolveItemActions', () => {
  for (const [status, primary] of Object.entries(EXPECTED) as ReadonlyArray<
    [ResolveQueueStatus, string | null]
  >) {
    it(`selects one primary for ${status}`, () => {
      const result = resolveItemActions({
        status,
        proposalKind: 'fix',
        sharedApprovalCount: 1,
        approveBlockedReason: null,
        refuseBlockedReason: null,
        hasAgent: true,
        hasGithubUrl: true,
        canStopRun: true,
        isEditing: false,
        isBusy: false,
      });

      expect(result.primary?.id ?? null).toBe(primary);
      expect(result.secondary === null || result.secondary.id !== result.primary?.id).toBe(true);
      expect(
        result.overflow.some((action) => action.id === 'resume_comment' && status !== 'later'),
      ).toBe(false);
    });
  }

  it('removes header decisions while editing', () => {
    const result = resolveItemActions({
      status: 'fix_ready',
      proposalKind: 'fix',
      sharedApprovalCount: 2,
      approveBlockedReason: null,
      refuseBlockedReason: null,
      hasAgent: true,
      hasGithubUrl: true,
      canStopRun: true,
      isEditing: true,
      isBusy: false,
    });

    expect(result).toEqual({ primary: null, secondary: null, overflow: [] });
  });
});
