import type { ScriptRunStatus } from './scripts';

type Params = {
  readonly status: ScriptRunStatus;
  readonly exitCode: number | null;
};

export const scriptOutcomeLabel = ({ status, exitCode }: Params): string => {
  if (status === 'cancelled') {
    return 'Stopped';
  }
  if (status === 'pending' || status === 'idle') {
    return 'Still running';
  }
  return exitCode === null ? 'Finished' : `Exit ${exitCode}`;
};
