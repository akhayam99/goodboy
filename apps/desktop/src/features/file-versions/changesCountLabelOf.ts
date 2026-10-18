import type { TurnChangesSummary } from './turnChanges';

type Params = Readonly<{ counts: TurnChangesSummary }>;

export const changesCountLabelOf = ({ counts }: Params): string | null => {
  if (counts.fileCount === 0) {
    return null;
  }
  const files = `${counts.fileCount} ${counts.fileCount === 1 ? 'file' : 'files'}`;
  const turns = `${counts.turnCount} ${counts.turnCount === 1 ? 'turn' : 'turns'}`;
  return `${files} over ${turns}`;
};
