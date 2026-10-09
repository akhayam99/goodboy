import { listResolveQueueItems } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { publishThreadNow } from './publishThreadNow';
import { handledByLine } from './threadGitState';
import type { SliceParams, ThreadParams } from './types';

type RemoteResolveMode = 'reply' | 'resolve_only';

type Params = SliceParams &
  ThreadParams & { readonly mode: RemoteResolveMode; readonly reply?: string };

const SETTLED = new Set(['fixed', 'answered']);

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
    throw new Error('This comment is no longer in Comments');
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
  await publishThreadNow({ get, sessionId, threadId });
};
