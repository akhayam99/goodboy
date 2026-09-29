import { listResolveQueueItems } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { handledByLine } from './threadGitState';
import type { SliceParams, ThreadParams } from './types';

export type RemoteResolveMode = 'reply' | 'resolve_only';

type Params = SliceParams &
  ThreadParams & { readonly mode: RemoteResolveMode; readonly reply?: string };

const SETTLED = new Set(['fixed', 'answered']);

export const NOTHING_TO_PUBLISH = 'Nothing is waiting to go out for this comment';

export const resolveThreadOnRemote = async ({
  get,
  sessionId,
  threadId,
  mode,
  reply: override,
}: Params): Promise<void> => {
  const entry = (await listResolveQueueItems({ db: tauriDatabase, sessionId })).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (entry === undefined) {
    throw new Error('This comment is no longer in Review');
  }
  const facts = get().sessionThreadGit[sessionId]?.[threadId] ?? null;
  const isStale = facts?.gitState === 'missing';
  if (override !== undefined || isStale || !SETTLED.has(entry.thread.state)) {
    const elsewhere = facts?.elsewhere ?? null;
    const fallback =
      mode !== 'reply' ? '' : elsewhere !== null ? handledByLine({ fix: elsewhere }) : '';
    await get().answerItemWithoutFix({
      sessionId,
      itemId: entry.item.id,
      reply: override ?? fallback,
      ...(isStale && { allowIntegrated: true }),
    });
  }
  const preview = await get().preparePublication({ sessionId, threadIds: [threadId] });
  if (preview.publicationId === null) {
    throw new Error(preview.blocker === null ? NOTHING_TO_PUBLISH : `Blocked: ${preview.blocker}`);
  }
  const result = await get().publishConversations({
    sessionId,
    publicationId: preview.publicationId,
  });
  if (result.kind === 'done') {
    if (result.failed > 0) {
      throw new Error(result.error ?? 'The reply could not be posted');
    }
    return;
  }
  if (result.kind === 'push_failed') {
    throw new Error(result.error);
  }
  throw new Error(
    result.kind === 'busy'
      ? 'Another push is already running for this pull request'
      : NOTHING_TO_PUBLISH,
  );
};
