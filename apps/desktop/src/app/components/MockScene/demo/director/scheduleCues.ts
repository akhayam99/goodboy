import type { AgentId, IsoDateTime } from '@goodboy/types';
import { demoRuns } from './demoRunRegistry';
import type { DemoCue, DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly cues: ReadonlyArray<DemoCue>;
  readonly now: () => IsoDateTime;
  readonly agentId?: AgentId;
};

export const scheduleCues = ({ store, cues, now, agentId }: Params): (() => void) => {
  const generation = demoRuns.generation();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const clearTimers = (): void => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
  };
  const untrack = demoRuns.track({ agentId, cancel: clearTimers });
  for (const cue of cues) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (timers.size === 0) {
        untrack();
      }
      if (!demoRuns.isCurrent({ generation })) {
        return;
      }
      cue.apply({ store, at: now(), hint: () => undefined });
    }, cue.atMs);
    timers.add(timer);
  }
  if (timers.size === 0) {
    untrack();
  }
  return () => {
    clearTimers();
    untrack();
  };
};
