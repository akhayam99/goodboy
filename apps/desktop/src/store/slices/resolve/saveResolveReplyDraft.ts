import { listResolveThreads, setResolveThreadReplyDraft } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly revision: number;
  readonly reply: string;
};

export const saveResolveReplyDraft = async ({
  sessionId,
  threadId,
  revision,
  reply,
}: Params): Promise<boolean> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const row = rows.find((candidate) => candidate.threadId === threadId) ?? null;
  if (row === null || (row.replyDraft ?? '') === reply) {
    return true;
  }
  return setResolveThreadReplyDraft({ db, sessionId, threadId, revision, reply });
};
