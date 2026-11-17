import type { ResolveThread } from '@goodboy/types';
import type {
  ResolverThreadOutcome,
  ResolverThreadQuestion,
} from '../../../features/session/resolverTurnOutcomes';
import { NEEDS_RUN_REASON } from '../../../features/resolve/needsRunReason';
import { outcomePatch } from './outcomePatch';
import { threadOutcome } from './threadOutcome';

type Params = {
  readonly row: ResolveThread;
  readonly previous: ResolveThread | undefined;
  readonly outcome: ResolverThreadOutcome | undefined;
  readonly asked: ResolverThreadQuestion | undefined;
  readonly needsRun: string | undefined;
  readonly analysisVerdict: 'fix' | 'wontfix' | undefined;
  readonly question: string | null;
};

const FAILED_PATCH = {
  state: 'failed',
  disposition: null,
  commitShas: null,
  replyDraft: null,
  question: null,
} as const satisfies Partial<ResolveThread>;

export const resolveTurnPatchOf = ({
  row,
  previous,
  outcome,
  asked,
  needsRun,
  analysisVerdict,
  question,
}: Params): Partial<ResolveThread> => {
  const retained = threadOutcome({ row });
  const verdict = analysisVerdict ?? (row.disposition === 'no_change' ? 'wontfix' : undefined);
  const asking = retained === null ? { stateReason: 'question' } : {};
  if (asked !== undefined) {
    return { state: 'needs_answer', question: asked.question, ...asking };
  }
  if (outcome !== undefined) {
    return outcomePatch({ outcome, verdict, previous });
  }
  if (retained !== null) {
    return outcomePatch({ outcome: retained, verdict, previous });
  }
  if (needsRun !== undefined) {
    return { ...FAILED_PATCH, stateReason: NEEDS_RUN_REASON.stateReasonOf({ reason: needsRun }) };
  }
  if (question === null) {
    return { ...FAILED_PATCH, stateReason: null };
  }
  return { state: 'needs_answer', question, ...asking };
};
