// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveThread, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { attentionWordsOf } from '../../../features/session/session-stage';
import { resolveAttentionOf } from '../resolve/resolveAttention';
import { deriveSessionStage } from './deriveSessionStage';

const DATE = '2026-10-07T00:00:00.000Z';

const session: Session = {
  id: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Stop retried webhooks posting a second credit',
  state: { kind: 'idle', lastActivityAt: DATE as Session['createdAt'] },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE as Session['createdAt'],
  updatedAt: DATE as Session['updatedAt'],
};

type Waiting = Pick<ResolveThread, 'state' | 'stateReason' | 'activeAttemptId' | 'originKind'>;

const waiting = ({
  originKind,
}: {
  readonly originKind: ResolveThread['originKind'];
}): Waiting => ({
  state: 'needs_answer',
  stateReason: null,
  activeAttemptId: null,
  originKind,
});

const stageOf = ({ threads }: { readonly threads: ReadonlyArray<Waiting> }) => {
  const attention = resolveAttentionOf({ threads, attempts: [] });
  return deriveSessionStage({
    session,
    pr: null,
    hasUnread: false,
    openQuestionCount: 0,
    fixNeedsYouCount: attention.needsYou,
    fixCouldntFixCount: attention.couldntFix,
    noteNeedsYouCount: attention.notesNeedYou,
    noteCouldntFixCount: attention.notesCouldntFix,
  });
};

describe('a waiting note and a waiting comment are counted once each, apart', () => {
  it('counts a comment under comments and a note under notes', () => {
    const attention = resolveAttentionOf({
      threads: [waiting({ originKind: 'review_comment' }), waiting({ originKind: 'diff_comment' })],
      attempts: [],
    });

    expect(attention).toMatchObject({ needsYou: 1, notesNeedYou: 1 });
  });

  it('reads both on the Needs you reason, never one of them twice', () => {
    const info = stageOf({
      threads: [waiting({ originKind: 'review_comment' }), waiting({ originKind: 'diff_comment' })],
    });

    expect(info.attention).toBe('fix-needs-you');
    expect(info.reason).toBe('1 comment and 1 note need you');
    expect(info.fixNeedsYouCount).toBe(1);
    expect(info.noteNeedsYouCount).toBe(1);
    expect(
      attentionWordsOf({
        reason: 'fix-needs-you',
        counts: { fixNeedsYouCount: 1, noteNeedsYouCount: 1 },
      }),
    ).toBe('1 comment and 1 note need you');
  });

  it('raises Needs you for a note alone and keeps the comment wording when no note waits', () => {
    expect(stageOf({ threads: [waiting({ originKind: 'diff_comment' })] }).reason).toBe(
      '1 note needs you',
    );
    expect(stageOf({ threads: [waiting({ originKind: 'review_comment' })] }).reason).toBe(
      '1 comment needs you',
    );
    expect(
      attentionWordsOf({ reason: 'fix-couldnt-fix', counts: { noteCouldntFixCount: 2 } }),
    ).toBe("2 notes it couldn't fix");
  });
});
