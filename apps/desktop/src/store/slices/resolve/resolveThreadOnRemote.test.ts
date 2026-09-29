import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { resolveThreadOnRemote } from './resolveThreadOnRemote';
import type { ThreadGitFacts } from './threadGitState';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({ listQueue: vi.fn() }));
vi.mock('@goodboy/db', () => ({ listResolveQueueItems: h.listQueue }));
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
  const answerItemWithoutFix = vi.fn(async () => undefined);
  const state = {
    sessionThreadGit: { [sessionId]: { [threadId]: git } },
    answerItemWithoutFix,
    preparePublication: vi.fn(async () => ({ publicationId: 'pub', blocker: null })),
    publishConversations: vi.fn(async () => ({ kind: 'done', failed: 0 })),
  };
  await resolveThreadOnRemote({
    set: (() => undefined) as unknown as SetFn,
    get: (() => state) as unknown as GetFn,
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

  it('answers a folded fix with the sha it landed as', async () => {
    const answer = await run({
      git: facts({ gitState: 'folded', folded: { sha: '9f2c1ab', landedAs: 'e31b9f4abcd' } }),
      threadState: 'fixed',
    });
    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'Handled in e31b9f4.', allowIntegrated: true }),
    );
  });

  it('leaves a settled fix that is on origin as it was', async () => {
    const answer = await run({
      git: facts({ gitState: 'on_origin', onOrigin: { sha: 'c81e5aa', branch: 'main' } }),
      threadState: 'fixed',
    });
    expect(answer).not.toHaveBeenCalled();
  });
});
