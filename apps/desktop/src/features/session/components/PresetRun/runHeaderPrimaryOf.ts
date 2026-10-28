import type { OpenQuestion } from '@goodboy/types';
import type { RunPrimary } from '../../../workflows/runPrimaryOf';
import type { RunView } from '../AgentTree/useRunView';

export type RunHeaderPrimary =
  | { readonly kind: 'primary'; readonly primary: RunPrimary }
  | { readonly kind: 'raiseCap' }
  | { readonly kind: 'answer'; readonly question: OpenQuestion }
  | { readonly kind: 'live' };

type Params = {
  readonly view: RunView;
};

export const runHeaderPrimaryOf = ({ view }: Params): RunHeaderPrimary => {
  const { primary } = view;
  const isOpen = !view.isDiscarded && !view.isCompleted;
  const question = view.answerQuestion ?? view.advance.questions[0] ?? null;
  if (isOpen && question !== null) {
    return { kind: 'answer', question };
  }
  if (isOpen && view.run.orchestrationStop?.kind === 'budget' && primary?.kind !== 'raise-cap') {
    return { kind: 'raiseCap' };
  }
  if (
    primary === null ||
    primary.kind === 'resume' ||
    primary.kind === 'answer' ||
    primary.kind === 'hint'
  ) {
    return { kind: 'live' };
  }
  return { kind: 'primary', primary };
};
