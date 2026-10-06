import { listResolvePublicationThreads, listResolvePublicationsForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, ThreadParams } from './types';

type Params = { readonly get: GetFn } & ThreadParams;

export const NOTHING_TO_PUBLISH = 'Nothing is waiting to go out for this comment';

const failedPublicationOf = async ({
  sessionId,
  threadId,
}: ThreadParams): Promise<string | null> => {
  const publications = await listResolvePublicationsForSession({ db: tauriDatabase, sessionId });
  const failed = publications
    .filter((publication) => publication.phase === 'failed' && !publication.requiresPush)
    .sort((left, right) => right.createdAt - left.createdAt);
  for (const publication of failed) {
    const threads = await listResolvePublicationThreads({
      db: tauriDatabase,
      publicationId: publication.id,
    });
    if (threads.length === 1 && threads[0]?.threadId === threadId) {
      return publication.id;
    }
  }
  return null;
};

const preparedPublicationOf = async ({ get, sessionId, threadId }: Params): Promise<string> => {
  const preview = await get().preparePublication({ sessionId, threadIds: [threadId] });
  if (preview.publicationId === null) {
    throw new Error(preview.blocker === null ? NOTHING_TO_PUBLISH : `Blocked: ${preview.blocker}`);
  }
  return preview.publicationId;
};

export const publishThreadNow = async ({ get, sessionId, threadId }: Params): Promise<void> => {
  const publicationId =
    (await failedPublicationOf({ sessionId, threadId })) ??
    (await preparedPublicationOf({ get, sessionId, threadId }));
  const result = await get().publishConversations({ sessionId, publicationId });
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
