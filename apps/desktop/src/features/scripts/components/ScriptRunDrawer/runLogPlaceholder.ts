import type { ScriptRunStatus } from '../../scripts';

type Params = {
  readonly status: ScriptRunStatus;
};

export const runLogPlaceholder = ({ status }: Params): string => {
  switch (status) {
    case 'idle':
      return 'Its output shows here once it runs.';
    case 'pending':
      return 'Waiting for output';
    case 'cancelled':
      return 'Stopped, no output recorded';
    case 'ok':
    case 'error':
      return 'No output';
    default: {
      const exhaustive: never = status;
      return String(exhaustive);
    }
  }
};
