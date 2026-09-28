import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  insertResolveQueueItem,
  listResolveQueueItems,
  migrate,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeTestDatabase } from '@goodboy/db/test-helpers';
import type { ResolveQueueItem, ResolveStage, ResolveThread, SessionId } from '@goodboy/types';
import { createResolveSlice } from '../../store/slices/resolve';
import { resolveInitialState } from '../../store/slices/resolve/state';
import type { GetFn, SetFn } from '../../store/slices/resolve/types';
import { resolveDecisionVerb } from './resolveDecisionVerb';
import { resolveItemActions, type ResolveItemActionId } from './resolveItemActions';
import type { ResolveUiState } from './resolveRowState';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../../shared/lib/db', () => ({ tauriDatabase: h }));

const sessionId = 'session' as SessionId;
const thread: ResolveThread = {
  id: 'thread-row',
  sessionId,
  projectId: null,
  prNumber: 1,
  threadId: 'thread',
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'proposed',
  stateReason: null,
  revision: 2,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'reply',
  replyDraft: 'Reply',
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
};
const item: ResolveQueueItem = {
  id: 'item',
  sessionId,
  threadId: 'thread',
  generation: 0,
  reopenedFromItemId: null,
  candidateRevision: 2,
  approvalState: 'none',
  approvedRevision: null,
  approvedReplyHash: null,
  integratedSha: null,
  deferredAt: null,
  deliveredAt: null,
  supersededAt: null,
  createdAt: 1,
  updatedAt: 1,
};
let db: Database;

const createHarness = () => {
  const store = createStore(() => ({
    ...resolveInitialState,
    sessionResolveThreads: { [sessionId]: [thread] },
  }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return createResolveSlice({ set, get });
};

beforeEach(async () => {
  db = makeTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  await migrate(db);
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await upsertResolveThread({ db, row: thread, expectedRevision: null });
  await insertResolveQueueItem({ db, item });
});

const UI_STATE: Partial<Record<ResolveStage, ResolveUiState>> = {
  approved: 'approved',
  parked: 'later',
};

const decisionActionIds = ({ status }: { readonly status: ResolveUiState }) => {
  const set = resolveItemActions({
    status,
    proposalKind: 'reply_only',
    failedStep: null,
    sharedApprovalCount: 1,
    resolveBlockedReason: null,
    closeBlockedReason: null,
    hasQuestion: false,
    hasAgent: false,
    hasGithubUrl: true,
    canStopRun: false,
    isEditing: false,
    isBusy: false,
  });
  return [set.primary, set.secondary, ...set.overflow].flatMap((action) =>
    action === null || resolveDecisionVerb({ actionId: action.id }) === null ? [] : [action.id],
  );
};

type Decision = 'accept' | 'refuse' | 'defer';

const decide = async ({
  actions,
  decision,
}: {
  readonly actions: ReturnType<typeof createHarness>;
  readonly decision: Decision;
}) => {
  if (decision === 'accept') {
    await actions.acceptResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    return;
  }
  if (decision === 'refuse') {
    await actions.refuseResolveQueueItem({
      sessionId,
      itemId: item.id,
      revision: 2,
      reply: 'Reply',
    });
    return;
  }
  await actions.deferResolveQueueItem({ sessionId, itemId: item.id });
};

const runVerb = async ({
  actions,
  actionId,
}: {
  readonly actions: ReturnType<typeof createHarness>;
  readonly actionId: ResolveItemActionId;
}) => {
  const verb = resolveDecisionVerb({ actionId });
  if (verb === 'take_up') {
    await actions.takeUpResolveQueueItem({ sessionId, itemId: item.id });
    return;
  }
  if (verb === 'reopen') {
    await actions.reopenResolveQueueItem({ sessionId, itemId: item.id, revision: 2 });
  }
};

describe('comment decision state matrix', () => {
  it.each([
    { decision: 'accept', approvalState: 'accepted', actionId: 'change_decision' },
    { decision: 'refuse', approvalState: 'wont_fix', actionId: 'change_decision' },
    { decision: 'defer', approvalState: 'deferred', actionId: 'resume_comment' },
  ] as const)(
    'after $decision the row offers $actionId and the store takes it back to undecided',
    async ({ decision, approvalState, actionId }) => {
      const actions = createHarness();
      await decide({ actions, decision });
      const [decided] = await listResolveQueueItems({ db, sessionId });
      expect(decided?.item.approvalState).toBe(approvalState);
      const status = decided === undefined ? undefined : UI_STATE[decided.thread.stage];
      expect(status).toBeDefined();

      const offered = decisionActionIds({ status: status ?? 'new' });
      expect(offered).toEqual([actionId]);

      await expect(runVerb({ actions, actionId })).resolves.toBeUndefined();
      const [after] = await listResolveQueueItems({ db, sessionId });
      expect(after?.item.approvalState).toBe('none');
      expect(after?.item.approvedRevision).toBeNull();
    },
  );

  it('moves an approved comment back to review, not to parked', async () => {
    const actions = createHarness();
    await decide({ actions, decision: 'accept' });

    await runVerb({ actions, actionId: 'change_decision' });

    const [after] = await listResolveQueueItems({ db, sessionId });
    expect(after?.thread.stage).toBe('proposed');
    expect(after?.item.reopenedFromItemId).toBe(item.id);
  });

  it('keeps take-up off approved comments, which the database refuses', async () => {
    const actions = createHarness();
    await decide({ actions, decision: 'accept' });

    await expect(actions.takeUpResolveQueueItem({ sessionId, itemId: item.id })).rejects.toThrow(
      'could not be taken up',
    );
    expect(resolveDecisionVerb({ actionId: 'change_decision' })).toBe('reopen');
  });
});
