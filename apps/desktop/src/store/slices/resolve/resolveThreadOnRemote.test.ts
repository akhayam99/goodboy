import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvePublicationPreview, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { AppStore } from '../../store';
import type { PublishConversationsResult } from './publishConversations';
import { resolveThreadOnRemote } from './resolveThreadOnRemote';
import type { ThreadGitFacts } from './threadGitState';
import type { GetFn } from './types';

const h = vi.hoisted(() => ({ listQueue: vi.fn() }));
vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  listResolveQueueItems: h.listQueue,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

const sessionId = 'session' as SessionId;
const threadId = 'PRRT_1';

const facts = (overrides: Partial<ThreadGitFacts>): ThreadGitFacts => ({
  gitState: 'local',
  onOrigin: null,
  elsewhere: null,
  missing: null,
  folded: null,
  userReply: null,
  verdict: null,
  ...overrides,
});

const PREVIEW: ResolvePublicationPreview = {
  publicationId: 'pub',
  repo: 'acme/payments-api',
  prNumber: 318,
  branch: 'hl/fix-duplicate-credit',
  localHead: 'c81e5aaaaaa',
  remoteHead: null,
  requiresPush: false,
  frozenAt: 1,
  commits: [],
  unapproved: [],
  replies: [],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
};

const DONE: PublishConversationsResult = {
  kind: 'done',
  pushed: false,
  pushedHead: null,
  total: 1,
  replies: 1,
  replied: 1,
  closed: 1,
  resolved: 1,
  leftOpen: 0,
  failed: 0,
  error: null,
};

const run = async ({
  git,
  threadState,
  reply,
}: {
  readonly git: ThreadGitFacts;
  readonly threadState: string;
  readonly reply?: string;
}) => {
  h.listQueue.mockResolvedValue([
    { item: { id: 'item' }, thread: { threadId, state: threadState } },
  ]);
  const answerItemWithoutFix = vi.fn<AppStore['answerItemWithoutFix']>(async () => undefined);
  const state: ReturnType<GetFn> = {
    ...useAppStore.getInitialState(),
    sessionThreadGit: { [sessionId]: { [threadId]: git } },
    answerItemWithoutFix,
    preparePublication: vi.fn<AppStore['preparePublication']>(async () => PREVIEW),
    publishConversations: vi.fn<AppStore['publishConversations']>(async () => DONE),
  };
  await resolveThreadOnRemote({
    set: () => undefined,
    get: () => state,
    sessionId,
    threadId,
    mode: 'reply',
    ...(reply !== undefined && { reply }),
  });
  return answerItemWithoutFix;
};

describe('resolveThreadOnRemote', () => {
  beforeEach(() => h.listQueue.mockReset());

  it('posts the verdict reply and lets a missing fix override its integrated sha', async () => {
    const answer = await run({
      git: facts({
        gitState: 'missing',
        missing: { sha: '9f2c1ab', wasPushed: false, isPathGone: false },
      }),
      threadState: 'fixed',
      reply: 'Handled in e31b9f4.',
    });
    expect(answer).toHaveBeenCalledWith({
      sessionId,
      itemId: 'item',
      reply: 'Handled in e31b9f4.',
      allowIntegrated: true,
    });
  });

  it('leaves a folded fix to the normal push and answers nothing here', async () => {
    const answer = await run({
      git: facts({ gitState: 'folded', folded: { sha: '9f2c1ab', landedAs: 'e31b9f4abcd' } }),
      threadState: 'fixed',
    });
    expect(answer).not.toHaveBeenCalled();
  });

  it('leaves a settled fix that is on origin as it was', async () => {
    const answer = await run({
      git: facts({ gitState: 'on_origin', onOrigin: { sha: 'c81e5aa', branch: 'main' } }),
      threadState: 'fixed',
    });
    expect(answer).not.toHaveBeenCalled();
  });
});
