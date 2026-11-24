import type { Candidate } from '@goodboy/core/providers';
import type { AutoRoutingCandidate, AutoRoutingPick } from '@goodboy/types';
import type { RoutingOutcome } from '../ports';

const STORED_CANDIDATES_MAX = 18;

type CandidatesParams = {
  readonly rows: ReadonlyArray<Candidate>;
};

const storedCandidatesOf = ({ rows }: CandidatesParams): ReadonlyArray<AutoRoutingCandidate> =>
  [...rows.filter((row) => row.cause === null), ...rows.filter((row) => row.cause !== null)]
    .slice(0, STORED_CANDIDATES_MAX)
    .map((row) => ({
      provider: row.provider,
      model: row.model,
      effort: row.effort,
      order: row.order,
      isLighter: row.isLighter,
      room: row.room,
      load: row.load,
      cause: row.cause,
    }));

type Params = {
  readonly outcome: Extract<RoutingOutcome, { kind: 'ready' }>;
};

export const routingPickOf = ({ outcome }: Params): AutoRoutingPick => {
  const candidates = outcome.candidates ?? [];
  return {
    provider: outcome.provider,
    model: outcome.model,
    effort: outcome.effort,
    reason: outcome.reason,
    proposal: outcome.proposal,
    ...(outcome.source !== undefined && { source: outcome.source }),
    ...(outcome.cause != null && { cause: outcome.cause }),
    ...(candidates.length > 0 && { candidates: storedCandidatesOf({ rows: candidates }) }),
  };
};
