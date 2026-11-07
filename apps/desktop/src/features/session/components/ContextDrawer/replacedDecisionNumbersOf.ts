import type { SessionDecision } from '@goodboy/types';

type Params = {
  readonly decisions: ReadonlyArray<SessionDecision>;
};

export const replacedDecisionNumbersOf = ({ decisions }: Params): ReadonlyMap<number, number> => {
  const map = new Map<number, number>();
  for (const row of decisions) {
    if (row.replacedBy !== null && row.replacedBy > row.number) {
      map.set(row.replacedBy, row.number);
    }
  }
  return map;
};
