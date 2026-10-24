import type { DemoBeat } from './demoChapters';

type Params = {
  readonly beat: DemoBeat;
  readonly replayKey: number;
};

export const frameKey = ({ beat, replayKey }: Params): string =>
  `${beat.scene}?${new URLSearchParams(beat.params).toString()}#${replayKey}`;
