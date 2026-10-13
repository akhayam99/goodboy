import type { ResolveThread } from '@goodboy/types';
import type {
  ResolverThreadOutcome,
  ResolverThreadQuestion,
} from '../../../features/session/resolverTurnOutcomes';
import { outcomePatch } from './outcomePatch';
import { threadOutcome } from './threadOutcome';

type Params = {
  readonly row: ResolveThread;
  readonly previous: ResolveThread | undefined;
  readonly outcome: ResolverThreadOutcome | undefined;
  readonly asked: ResolverThreadQuestion | undefined;
  readonly analysisVerdict: 'fix' | 'wontfix' | undefined;
  readonly question: string | null;
};

export const resolveTurnPatchOf = ({
  row,
  previous,
  outcome,
  asked,
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
  if (question === null) {
    return {
      state: 'failed',
      stateReason: null,
      disposition: null,
      commitShas: null,
      replyDraft: null,
      question: null,
    };
  }
  return { state: 'needs_answer', question, ...asking };
};
