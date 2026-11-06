import type { ActionConfirm } from '../types';
import type { MountFacts } from './mountFacts';

type Params = {
  readonly facts: Pick<MountFacts, 'branch'>;
};

export const mountCleanUpWordsOf = ({ facts }: Params): Pick<ActionConfirm, 'goes' | 'stays'> => ({
  goes: `Its folder and the local branch ${facts.branch}`,
  stays: 'The pull request, and the remote branch unless your after-merge setting removes it',
});
