import type { IsoDateTime } from '@goodboy/types';
import type { DemoCue, DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly cues: ReadonlyArray<DemoCue>;
  readonly now: () => IsoDateTime;
};

export const scheduleCues = ({ store, cues, now }: Params): (() => void) => {
  const timers = cues.map((cue) =>
    setTimeout(() => {
      cue.apply({ store, at: now(), hint: () => undefined });
    }, cue.atMs),
  );
  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
};
