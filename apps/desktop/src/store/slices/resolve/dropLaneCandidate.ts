import {
  getReadyResolveCandidateForItem,
  listResolveCandidateItems,
  setResolveCandidateState,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { loadResolveCandidatesInto } from './loadResolveCandidatesInto';
import type { ItemParams, SetFn } from './types';

type Params = ItemParams & { readonly set: SetFn };

export const dropLaneCandidate = async ({ set, sessionId, itemId }: Params): Promise<void> => {
  const db = tauriDatabase;
  const candidate = await getReadyResolveCandidateForItem({ db, queueItemId: itemId });
  if (candidate === null) {
    return;
  }
  const members = await listResolveCandidateItems({ db, candidateId: candidate.id });
  if (members.some((member) => member.queueItemId !== itemId)) {
    return;
  }
  await setResolveCandidateState({ db, candidateId: candidate.id, state: 'discarded' });
  await loadResolveCandidatesInto({ set, sessionId });
};
