import { brandId, type ArtifactId, type AutoTreeId } from '@goodboy/types';
import type { Database } from '@goodboy/db';
import {
  discardAutoPlan,
  type DiscardAutoPlanOutcome,
} from '../../../store/runtime/auto/close/discardAutoPlan';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly artifactId: string;
};

const REFUSED_SENTENCE = {
  unknown: 'This plan is no longer in the conversation.',
  consumed: 'This plan was already used to start the work.',
  revising: 'The Planner is revising this plan. Wait for the new version.',
} as const satisfies Readonly<
  Record<Exclude<DiscardAutoPlanOutcome, 'discarded' | 'already_discarded'>, string>
>;

export const dropAutoPlan = async ({ db, treeId, artifactId }: Params): Promise<void> => {
  const outcome = await discardAutoPlan({
    db,
    treeId,
    artifactId: brandId<ArtifactId>({ value: artifactId }),
    nowMs: Date.now(),
  });
  if (outcome === 'discarded' || outcome === 'already_discarded') {
    return;
  }
  throw new Error(REFUSED_SENTENCE[outcome]);
};
