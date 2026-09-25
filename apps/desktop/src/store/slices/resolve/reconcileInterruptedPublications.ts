import {
  listResolvePublicationThreads,
  listResolveThreads,
  setResolvePublicationPhase,
  setResolveThreadState,
  upsertResolvePublicationThread,
} from '@goodboy/db';
import type { ResolvePublication, ResolvePublicationThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { isDeliveryComplete } from './deliveryReceipts';
import { nextStage } from './nextStage';
import { isPublicationStale } from './publicationHeartbeat';

export const PUBLICATION_INTERRUPTED = 'The app stopped while publishing';
const REPLY_UNCERTAIN = `${PUBLICATION_INTERRUPTED}, the reply is uncertain`;

const isInFlight = ({ receipt }: { readonly receipt: ResolvePublicationThread }): boolean =>
  receipt.replyPhase === 'sending' || receipt.resolvePhase === 'resolving';

const interruptedReceipt = ({
  receipt,
}: {
  readonly receipt: ResolvePublicationThread;
}): ResolvePublicationThread => ({
  ...receipt,
  replyPhase: receipt.replyPhase === 'sending' ? 'uncertain' : receipt.replyPhase,
  resolvePhase: receipt.resolvePhase === 'resolving' ? 'uncertain' : receipt.resolvePhase,
  error: receipt.error ?? (isInFlight({ receipt }) ? REPLY_UNCERTAIN : PUBLICATION_INTERRUPTED),
});

const recoverPublication = async ({
  publication,
}: {
  readonly publication: ResolvePublication;
}): Promise<void> => {
  const receipts = await listResolvePublicationThreads({
    db: tauriDatabase,
    publicationId: publication.id,
  });
  const rows = await listResolveThreads({ db: tauriDatabase, sessionId: publication.sessionId });
  for (const receipt of receipts) {
    if (receipt.error === null && isDeliveryComplete({ receipt })) {
      continue;
    }
    const recovered = interruptedReceipt({ receipt });
    await upsertResolvePublicationThread({ db: tauriDatabase, thread: recovered });
    const row = rows.find((candidate) => candidate.threadId === receipt.threadId);
    if (row?.state !== 'publishing') {
      continue;
    }
    const restored =
      receipt.priorState === 'fixed' || receipt.priorState === 'answered'
        ? receipt.priorState
        : receipt.resolvePhase === 'skipped'
          ? 'answered'
          : 'fixed';
    await setResolveThreadState({
      db: tauriDatabase,
      sessionId: publication.sessionId,
      threadId: row.threadId,
      revision: row.revision,
      state: restored,
      stage: nextStage({ stage: row.stage, event: { kind: 'interrupted' } }),
      stateReason: `publication_failed:${JSON.stringify({
        error: recovered.error,
        reason: row.stateReason,
      })}`,
    });
  }
  await setResolvePublicationPhase({
    db: tauriDatabase,
    id: publication.id,
    phase: 'failed',
    error: PUBLICATION_INTERRUPTED,
  });
};

type Params = {
  readonly publications: ReadonlyArray<ResolvePublication>;
  readonly now: number;
};

export const reconcileInterruptedPublications = async ({
  publications,
  now,
}: Params): Promise<ReadonlyArray<ResolvePublication>> => {
  const live: Array<ResolvePublication> = [];
  for (const publication of publications) {
    if (!isPublicationStale({ publication, now })) {
      live.push(publication);
      continue;
    }
    await recoverPublication({ publication });
  }
  return live;
};
