import type { StopAllResult } from './stopAllRunningAgents';

type Params = {
  readonly result: StopAllResult;
};

export const stopAllMessageOf = ({ result }: Params): string => {
  if (result.stillRunning === 0) {
    return `Stopped ${result.stopped}`;
  }
  if (result.stopped === 0) {
    return `${result.stillRunning} still running`;
  }
  return `Stopped ${result.stopped}, ${result.stillRunning} still running`;
};
