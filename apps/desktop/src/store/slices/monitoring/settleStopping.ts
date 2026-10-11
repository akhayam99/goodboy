import type { StopProgress } from './types';

type Params = {
  readonly pid: number;
  readonly progress: StopProgress | null;
};

type StoppingState = {
  readonly monitorStopping: Readonly<Record<number, StopProgress>>;
};

export const settleStopping =
  ({ pid, progress }: Params) =>
  (state: StoppingState) => {
    const kept = Object.entries(state.monitorStopping).filter(([key]) => Number(key) !== pid);
    const entries = progress === null ? kept : [...kept, [String(pid), progress]];
    return { monitorStopping: Object.fromEntries(entries) };
  };
