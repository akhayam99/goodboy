import type { ResolveThread } from '@goodboy/types';
import type { ResolverThreadOutcome } from '../../../features/session/resolverTurnOutcomes';

type Params = {
  readonly outcome: ResolverThreadOutcome;
  readonly verdict?: 'fix' | 'wontfix';
  readonly previous?: ResolveThread;
};

const commitLinks = ({
  previous,
  sha,
}: {
  readonly previous: ResolveThread | undefined;
  readonly sha: string | null;
}): Partial<ResolveThread> => {
  if (previous === undefined) {
    return {};
  }
  const prior = previous.commitShas?.at(-1) ?? null;
  if (sha !== null && prior === sha) {
    return {};
  }
  return { fixupOfSha: null, replacesSha: sha === null ? null : prior };
};

export const outcomePatch = ({ outcome, verdict, previous }: Params): Partial<ResolveThread> => {
  if (outcome.kind === 'resolved') {
    return {
      state: 'fixed',
      stateReason: null,
      disposition: 'fix',
      commitShas: [outcome.commitSha],
      ...commitLinks({ previous, sha: outcome.commitSha }),
      replyDraft: outcome.reply ?? null,
      question: null,
    };
  }
  if (outcome.kind === 'wontfix') {
    return {
      state: 'answered',
      stateReason: `wontfix:${outcome.reason}`,
      disposition: 'no_change',
      commitShas: null,
      ...commitLinks({ previous, sha: null }),
      replyDraft: outcome.reply ?? outcome.reason,
      question: null,
    };
  }
  const analysisVerdict = outcome.verdict ?? verdict;
  return {
    state: analysisVerdict === 'wontfix' ? 'answered' : 'needs_answer',
    stateReason:
      analysisVerdict === 'fix'
        ? 'proposed_fix'
        : analysisVerdict === 'wontfix'
          ? 'analysis_wontfix'
          : 'review_legacy_result',
    disposition: analysisVerdict === 'wontfix' ? 'no_change' : 'reply',
    commitShas: null,
    ...commitLinks({ previous, sha: null }),
    replyDraft: outcome.reply ?? null,
    question: null,
  };
};
