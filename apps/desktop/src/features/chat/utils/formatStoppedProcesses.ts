import type { StoppedProcess } from '@goodboy/types';

type Params = {
  readonly stopped: ReadonlyArray<StoppedProcess>;
};

export const formatStoppedProcesses = ({ stopped }: Params): string | null => {
  const [first, ...rest] = stopped;
  if (first === undefined) {
    return null;
  }
  const noun = stopped.length === 1 ? 'process' : 'processes';
  const names = rest.length > 0 ? `${first.name}, ${rest.length} more` : first.name;
  return `Stopped ${stopped.length} ${noun} this turn left running: ${names}.`;
};
