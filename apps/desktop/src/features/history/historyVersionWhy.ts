import type { HistoryBackupFacts } from '@goodboy/types';

type Params = {
  readonly facts: Pick<HistoryBackupFacts, 'isSameForkAsNext' | 'nextCommitCount'> & {
    readonly commitCount: number;
  };
};

export const historyVersionWhy = ({ facts }: Params): string => {
  if (!facts.isSameForkAsNext) {
    return 'Before a rebase';
  }
  if (facts.nextCommitCount < facts.commitCount) {
    return 'Before a fold or drop';
  }
  if (facts.nextCommitCount > facts.commitCount) {
    return 'Before a split';
  }
  return 'Before a reword or edit';
};
