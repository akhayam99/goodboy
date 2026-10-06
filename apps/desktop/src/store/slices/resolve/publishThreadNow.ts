import {
  listResolvePublicationThreads,
  listResolvePublicationsForSession,
  listResolveQueueItems,
  setResolvePublicationPhase,
} from '@goodboy/db';
import type { ResolvePublication, ResolveQueueItem } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { AMBIGUOUS_REPLY, reconcileUncertainReceipt } from './reconcileUncertainReceipt';
import type { GetFn, ThreadParams } from './types';

type Params = { readonly get: GetFn } & ThreadParams;

const NOTHING_TO_PUBLISH = 'Nothing is waiting to go out for this comment';
const PART_OF_A_PUSH =
  'This reply failed together with other conversations. Retry it from the pull request bar';
const SUPERSEDED = 'superseded';

const approvedItemOf = async ({
  sessionId,
  threadId,
}: ThreadParams): Promise<ResolveQueueItem | null> => {
  const entries = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  return (
    entries.find(
      ({ item, thread }) =>
        thread.threadId === threadId &&
        (item.approvalState === 'accepted' || item.approvalState === 'wont_fix') &&
        item.deliveredAt === null,
    )?.item ?? null
  );
};

const isCurrentApproval = ({
  publication,
  item,
}: {
  readonly publication: ResolvePublication;
  readonly item: ResolveQueueItem | null;
}): boolean =>
  item !== null &&
  publication.approvedItemIds.includes(item.id) &&
  item.updatedAt <= publication.createdAt;

const failedPublicationOf = async ({
  sessionId,
  threadId,
}: ThreadParams): Promise<string | null> => {
  const publications = await listResolvePublicationsForSession({ db: tauriDatabase, sessionId });
  const failed = publications
    .filter((publication) => publication.phase === 'failed')
    .sort((left, right) => right.createdAt - left.createdAt);
  const item = await approvedItemOf({ sessionId, threadId });
  for (const publication of failed) {
    const threads = await listResolvePublicationThreads({
      db: tauriDatabase,
      publicationId: publication.id,
    });
    if (!threads.some((receipt) => receipt.threadId === threadId)) {
      continue;
    }
    if (!isCurrentApproval({ publication, item })) {
      if (threads.length === 1 && !publication.requiresPush) {
        await setResolvePublicationPhase({
          db: tauriDatabase,
          id: publication.id,
          phase: 'cancelled',
          error: SUPERSEDED,
        });
      }
      continue;
    }
    if (threads.length > 1 || publication.requiresPush) {
      throw new Error(PART_OF_A_PUSH);
    }
    return publication.id;
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

const reconcileBeforeResume = async ({
  get,
  sessionId,
  threadId,
  publicationId,
}: Params & { readonly publicationId: string }): Promise<void> => {
  const receipt = (await listResolvePublicationThreads({ db: tauriDatabase, publicationId })).find(
    (item) => item.threadId === threadId,
  );
  if (receipt === undefined) {
    return;
  }
  const verdict = await reconcileUncertainReceipt({ get, sessionId, receipt });
  if (verdict === 'ambiguous') {
    throw new Error(`${AMBIGUOUS_REPLY}. Check the conversation on GitHub first`);
  }
};

export const publishThreadNow = async ({ get, sessionId, threadId }: Params): Promise<void> => {
  const failedId = await failedPublicationOf({ sessionId, threadId });
  if (failedId !== null) {
    await reconcileBeforeResume({ get, sessionId, threadId, publicationId: failedId });
  }
  const publicationId = failedId ?? (await preparedPublicationOf({ get, sessionId, threadId }));
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
