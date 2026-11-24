import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { catalogModelForId } from '../catalogModelForId';
import { bestCandidate } from './bestCandidate';
import type { CandidateCause } from './candidateCauses';
import type { Candidate, CandidateList, CandidatePick } from './types';

export type CheckedPick =
  | Readonly<{ kind: 'kept'; candidate: Candidate }>
  | Readonly<{ kind: 'moved'; cause: CandidateCause; candidate: Candidate }>
  | Readonly<{ kind: 'refused'; cause: CandidateCause }>;

type KeyParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

const modelKeyOf = ({ provider, model }: KeyParams): string | null =>
  catalogModelForId({ provider, modelId: model })?.key ?? null;

type MatchParams = {
  readonly list: CandidateList;
  readonly pick: CandidatePick;
};

type Match =
  | Readonly<{ kind: 'found'; candidate: Candidate }>
  | Readonly<{ kind: 'failed'; cause: CandidateCause }>;

const matchPick = ({ list, pick }: MatchParams): Match => {
  const provider = PROVIDER_IDS.find((candidate) => candidate === pick.provider) ?? null;
  if (provider === null) {
    return { kind: 'failed', cause: 'unknown-model' };
  }
  const key = modelKeyOf({ provider, model: pick.model });
  if (key === null) {
    return { kind: 'failed', cause: 'unknown-model' };
  }
  const matches = list.rows.filter(
    (row) => row.provider === provider && modelKeyOf({ provider, model: row.model }) === key,
  );
  const valid = matches.filter((row) => row.cause === null);
  const chosen = valid.find((row) => pick.effort == null || row.effort === pick.effort) ?? null;
  if (chosen !== null) {
    return { kind: 'found', candidate: chosen };
  }
  const struck = matches[0]?.cause ?? null;
  if (struck !== null) {
    return { kind: 'failed', cause: struck };
  }
  const excluded = list.excluded.find((entry) => entry.provider === provider)?.cause ?? null;
  if (excluded !== null) {
    return { kind: 'failed', cause: excluded };
  }
  return { kind: 'failed', cause: list.isPinned ? 'off-pin' : 'not-listed' };
};

type Params = MatchParams & {
  readonly batch?: ReadonlyArray<ProviderId>;
};

export const checkPick = ({ list, pick, batch = [] }: Params): CheckedPick => {
  const match = matchPick({ list, pick });
  if (match.kind === 'found') {
    return { kind: 'kept', candidate: match.candidate };
  }
  const best = bestCandidate({ list, batch });
  if (best === null) {
    return { kind: 'refused', cause: match.cause };
  }
  return { kind: 'moved', cause: match.cause, candidate: best };
};
