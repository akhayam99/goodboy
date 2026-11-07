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

type TitleParams = {
  readonly id: RunningSectionId;
  readonly groups: ReadonlyArray<LiveGroupModel>;
};

const sectionTitleOf = ({ id, groups }: TitleParams): string => {
  if (id === 'running') {
    return NAMES.running;
  }
  return groups.every((group) => group.state === 'failed') ? NAMES.failed : NAMES.stopped;
};

export const liveSectionsOf = ({ groups }: Params): ReadonlyArray<LiveSection> =>
  SECTION_ORDER.flatMap((id) => {
    const inSection = groups
      .filter((group) => liveSectionIdOf({ group }) === id)
      .sort((first, second) => first.startedAt - second.startedAt);
    return inSection.length === 0
      ? []
      : [{ id, title: sectionTitleOf({ id, groups: inSection }), groups: inSection }];
  });
