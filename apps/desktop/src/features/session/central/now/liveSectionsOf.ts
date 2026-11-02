import { NAMES } from '../../../../shared/utils/names';
import type { LiveGroupModel } from './liveGroupsOf';
import { liveSectionIdOf, type LiveSectionId } from './liveSectionIdOf';

type RunningSectionId = Exclude<LiveSectionId, 'needs-you'>;

export type LiveSection = Readonly<{
  id: RunningSectionId;
  title: string;
  groups: ReadonlyArray<LiveGroupModel>;
}>;

type Params = {
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

const SECTION_ORDER: ReadonlyArray<RunningSectionId> = ['running', 'stopped'];

const SECTION_TITLE: Readonly<Record<RunningSectionId, string>> = {
  running: NAMES.running,
  stopped: 'Stopped',
};

export const liveSectionsOf = ({ groups }: Params): ReadonlyArray<LiveSection> =>
  SECTION_ORDER.flatMap((id) => {
    const inSection = groups
      .filter((group) => liveSectionIdOf({ group }) === id)
      .sort((first, second) => first.startedAt - second.startedAt);
    return inSection.length === 0 ? [] : [{ id, title: SECTION_TITLE[id], groups: inSection }];
  });
