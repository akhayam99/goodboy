import { listResolveThreads, setResolveThreadReplyDraft } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly revision: number;
  readonly reply: string;
};

type DecideParams = Params & { readonly decide: () => Promise<void> };

export const withSavedReplyDraft = async ({
  sessionId,
  threadId,
  revision,
  reply,
  decide,
}: DecideParams): Promise<void> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const row = rows.find((candidate) => candidate.threadId === threadId) ?? null;
  const previous = row?.replyDraft ?? '';
  const isChanged = row !== null && previous !== reply;
  const isSaved =
    isChanged && (await setResolveThreadReplyDraft({ db, sessionId, threadId, revision, reply }));
  try {
    await decide();
  } catch (error) {
    if (isSaved) {
      await setResolveThreadReplyDraft({ db, sessionId, threadId, revision, reply: previous });
    }
    throw error;
  }
};
