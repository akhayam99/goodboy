import type { TurnChangesSummary } from './turnChanges';
import { countNoun } from '../../shared/utils/countNoun';

type Params = Readonly<{ counts: TurnChangesSummary }>;

export const changesCountLabelOf = ({ counts }: Params): string | null => {
  if (counts.fileCount === 0) {
    return null;
  }
  const files = `${countNoun({ count: counts.fileCount, one: 'file' })}`;
  const turns = `${countNoun({ count: counts.turnCount, one: 'reply', many: 'replies' })}`;
  return `${files} over ${turns}`;
};
