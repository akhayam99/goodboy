import type { LiveWorkRow } from '../../live-state/readLiveWork';

const EARLIER_STEPS = 2;

export type EarlierSteps = Readonly<Record<string, ReadonlyArray<LiveWorkRow>>>;

type Params = {
  readonly previous: ReadonlyArray<LiveWorkRow>;
  readonly earlier: EarlierSteps;
  readonly next: ReadonlyArray<LiveWorkRow>;
};

type RowParams = {
  readonly row: LiveWorkRow;
};

const stepKeyOf = ({ row }: RowParams): string =>
  row.tool === null ? '' : [row.tool.name, row.tool.command ?? '', row.tool.path ?? ''].join('\n');

export const earlierStepsOf = ({ previous, earlier, next }: Params): EarlierSteps => {
  const before = new Map(previous.map((row) => [row.runId, row]));
  return Object.fromEntries(
    next.map((row) => {
      const kept = earlier[row.runId] ?? [];
      const last = before.get(row.runId);
      if (
        last === undefined ||
        last.tool === null ||
        stepKeyOf({ row: last }) === stepKeyOf({ row })
      ) {
        return [row.runId, kept];
      }
      return [row.runId, [last, ...kept].slice(0, EARLIER_STEPS)];
    }),
  );
};
