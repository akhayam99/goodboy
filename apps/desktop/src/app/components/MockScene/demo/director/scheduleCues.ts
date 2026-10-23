import type { AgentId, IsoDateTime } from '@goodboy/types';
import { trackDemoRun } from './demoRunRegistry';
import type { DemoCue, DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly cues: ReadonlyArray<DemoCue>;
  readonly now: () => IsoDateTime;
  readonly agentId?: AgentId;
};

export const scheduleCues = ({ store, cues, now, agentId }: Params): (() => void) => {
  const timers = cues.map((cue) =>
    setTimeout(() => {
      cue.apply({ store, at: now(), hint: () => undefined });
    }, cue.atMs),
  );
  const cancel = (): void => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
  if (agentId !== undefined) {
    trackDemoRun({ agentId, cancel });
  }
  return cancel;
};
