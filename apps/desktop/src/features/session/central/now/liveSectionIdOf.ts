import type { LiveGroupModel } from './liveGroupsOf';

export type LiveSectionId = 'needs-you' | 'running' | 'stopped';

type GroupParams = {
  readonly group: LiveGroupModel;
};

const isStoppedByYou = ({ group }: GroupParams): boolean => {
  if (group.kind === 'auto') {
    return false;
  }
  const kind = group.rowState.reason?.kind;
  return kind === 'agentStopped' || kind === 'stepStopped' || kind === 'stopped';
};

export const liveSectionIdOf = ({ group }: GroupParams): LiveSectionId => {
  switch (group.state) {
    case 'failed':
      return 'stopped';
    case 'waiting':
      return isStoppedByYou({ group }) ? 'stopped' : 'needs-you';
    case 'working':
    case 'deciding':
      return 'running';
    default: {
      const exhaustive: never = group.state;
      return exhaustive;
    }
  }
};
