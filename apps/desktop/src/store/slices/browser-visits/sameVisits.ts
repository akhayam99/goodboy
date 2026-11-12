import type { BrowserVisit } from './types';

type Params = {
  readonly before: ReadonlyArray<BrowserVisit>;
  readonly after: ReadonlyArray<BrowserVisit>;
};

export const sameVisits = ({ before, after }: Params): boolean =>
  before.length === after.length &&
  before.every((visit, index) => {
    const next = after[index];
    return (
      next !== undefined &&
      next.url === visit.url &&
      next.title === visit.title &&
      next.visitedAt === visit.visitedAt
    );
  });
