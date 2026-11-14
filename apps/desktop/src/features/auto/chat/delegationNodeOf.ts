import type { WorkNodeState } from '@goodboy/ui';
import type { DelegationStatus } from './settledStatusOf';

type Params = {
  readonly status: DelegationStatus;
};

export const delegationNodeOf = ({ status }: Params): WorkNodeState => {
  if (status.node !== undefined) {
    return status.node;
  }
  switch (status.state) {
    case 'done':
      return 'done';
    case 'failed':
    case 'timedOut':
      return 'failed';
    case 'blocked':
      return 'alert';
    case 'returned':
      return 'skipped';
    case 'stopped':
      return 'stopped';
    case 'queued':
      return 'queued';
    case 'stopping':
    case 'confirming':
    case 'starting':
    case 'running':
    case 'paused':
      return 'running';
    default: {
      const exhaustive: never = status.state;
      return exhaustive;
    }
  }
};
