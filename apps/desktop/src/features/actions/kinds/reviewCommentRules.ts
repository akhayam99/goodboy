import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import type { ReviewCommentFacts } from './reviewComment';

export const UNDECIDED: ReadonlySet<ReviewCommentState> = new Set([
  'new',
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
]);

type FactsParams = {
  readonly facts: Pick<ReviewCommentFacts, 'remote'>;
};

export const hasOverlay = ({ facts }: FactsParams): boolean => facts.remote !== null;

type RunParams = {
  readonly facts: Pick<ReviewCommentFacts, 'runAgentId'>;
};

export const isOutsideRun = ({ facts }: RunParams): boolean => facts.runAgentId === null;

type RunEndParams = {
  readonly facts: Pick<ReviewCommentFacts, 'runEnd' | 'state'>;
};

export const isRunFinished = ({ facts }: RunEndParams): boolean =>
  facts.runEnd === 'finished' && UNDECIDED.has(facts.state);

type ChangeParams = {
  readonly facts: Pick<ReviewCommentFacts, 'runAgentId' | 'isSourceChanged'>;
};

export const isRunChanged = ({ facts }: ChangeParams): boolean =>
  facts.runAgentId !== null && facts.isSourceChanged;
