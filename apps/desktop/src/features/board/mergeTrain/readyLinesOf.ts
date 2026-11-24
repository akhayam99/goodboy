import { mergeOrderOf, type ReadyCar } from './mergeOrderOf';
import type { ReadyRow } from './readyToMergeOf';

export type ReadyLine = Readonly<{
  sessionId: string;
  number: number | null;
  title: string;
  car: ReadyCar | null;
  reason: string | null;
}>;

type Params = {
  readonly rows: ReadonlyArray<ReadyRow>;
  readonly cars: ReadonlyArray<ReadyCar>;
  readonly sessionTitles: ReadonlyMap<string, string>;
};

export const readyLinesOf = ({ rows, cars, sessionTitles }: Params): ReadonlyArray<ReadyLine> => {
  const ordered = mergeOrderOf({ cars }).map(({ car, reason }): ReadyLine => ({
    sessionId: car.sessionId,
    number: car.number,
    title: sessionTitles.get(car.sessionId) ?? '',
    car,
    reason,
  }));
  const rest = rows
    .filter((row) => !cars.some((car) => car.sessionId === row.sessionId))
    .map((row): ReadyLine => ({
      sessionId: row.sessionId,
      number: row.number,
      title: sessionTitles.get(row.sessionId) ?? '',
      car: null,
      reason: null,
    }));
  return [...ordered, ...rest];
};
