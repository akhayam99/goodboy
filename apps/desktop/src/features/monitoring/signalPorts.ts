import type { LearnedPorts, PinnedPort } from '@goodboy/core';
import type { SplitPortRows } from './splitPortRows';

type Params = {
  readonly split: Pick<SplitPortRows, 'goodboy'>;
  readonly pinned: ReadonlyArray<PinnedPort>;
  readonly learned: LearnedPorts;
};

export const signalPorts = ({ split, pinned, learned }: Params): ReadonlyArray<number> =>
  [
    ...new Set([
      ...pinned.map((pin) => pin.port),
      ...Object.values(learned).flat(),
      ...split.goodboy.map((row) => row.port),
    ]),
  ].sort((a, b) => a - b);
