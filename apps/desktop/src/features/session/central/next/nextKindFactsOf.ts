import type { ActionCardModel } from './actionCardsOf';
import type { NextGroupId } from './nextGroupIds';

type KindFacts = Readonly<{
  group: NextGroupId;
  rank: number;
}>;

const KIND_FACTS: Readonly<Record<ActionCardModel['kind'], KindFacts>> = {
  approve: { group: 'decide', rank: 0 },
  blocked: { group: 'decide', rank: 1 },
  question: { group: 'decide', rank: 2 },
  run: { group: 'decide', rank: 3 },
  agent: { group: 'decide', rank: 4 },
  'answer-questions': { group: 'decide', rank: 5 },
  'approve-tool': { group: 'decide', rank: 6 },
  'sign-in': { group: 'decide', rank: 7 },
  'plan-ready': { group: 'decide', rank: 8 },
  'workflow-next-step': { group: 'decide', rank: 9 },
  'continue-with-workflow': { group: 'decide', rank: 10 },
  'mount-project': { group: 'decide', rank: 11 },
  'check-changes': { group: 'decide', rank: 12 },
  childBlocked: { group: 'fix', rank: 0 },
  timedOut: { group: 'fix', rank: 1 },
  neverStarted: { group: 'fix', rank: 2 },
  failed: { group: 'fix', rank: 3 },
  fixRun: { group: 'fix', rank: 4 },
  'fix-checks': { group: 'fix', rank: 5 },
  'resolve-threads': { group: 'fix', rank: 6 },
  'retry-agent': { group: 'fix', rank: 7 },
  'resume-agents': { group: 'fix', rank: 8 },
  'rebase-project': { group: 'update', rank: 0 },
  rebase: { group: 'update', rank: 1 },
  'merge-pr': { group: 'ship', rank: 0 },
  'mark-ready': { group: 'ship', rank: 1 },
  'open-pr': { group: 'ship', rank: 2 },
  'push-branch': { group: 'ship', rank: 3 },
  'close-worktree': { group: 'ship', rank: 4 },
};

const DIVERGED: KindFacts = { group: 'update', rank: 2 };

type Params = {
  readonly card: ActionCardModel;
};

export const nextKindFactsOf = ({ card }: Params): KindFacts => {
  const { source } = card;
  if (
    source.kind === 'suggestion' &&
    source.suggestion.kind === 'push-branch' &&
    source.suggestion.payload.state === 'diverged'
  ) {
    return DIVERGED;
  }
  return KIND_FACTS[card.kind];
};
