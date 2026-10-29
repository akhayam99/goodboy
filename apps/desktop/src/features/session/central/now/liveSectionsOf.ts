import { NAMES } from '../../../../shared/utils/names';
import type { LiveGroupModel } from './liveGroupsOf';

type LiveSectionId = 'needs-you' | 'running' | 'stopped';

export type LiveSection = Readonly<{
  id: LiveSectionId;
  title: string;
  groups: ReadonlyArray<LiveGroupModel>;
}>;

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

type GroupParams = {
  readonly group: LiveGroupModel;
};

const SECTION_ORDER: ReadonlyArray<LiveSectionId> = ['needs-you', 'running', 'stopped'];

const WAITING_FOR_YOU = 'Waiting for you';

const SECTION_TITLE: Readonly<Record<LiveSectionId, string>> = {
  'needs-you': WAITING_FOR_YOU,
  running: NAMES.running,
  stopped: 'Stopped',
};

const isStoppedByYou = ({ group }: GroupParams): boolean => {
  if (group.kind === 'auto') {
    return false;
  }
  const kind = group.rowState.reason?.kind;
  return kind === 'agentStopped' || kind === 'stepStopped' || kind === 'stopped';
};

const liveSectionIdOf = ({ group }: GroupParams): LiveSectionId => {
  switch (group.state) {
    case 'stuck':
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

export const liveSectionsOf = ({ groups }: Params): ReadonlyArray<LiveSection> =>
  SECTION_ORDER.flatMap((id) => {
    const inSection = groups
      .filter((group) => liveSectionIdOf({ group }) === id)
      .sort((first, second) => first.startedAt - second.startedAt);
    return inSection.length === 0 ? [] : [{ id, title: SECTION_TITLE[id], groups: inSection }];
  });
