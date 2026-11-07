import { NAMES } from '../../../../shared/utils/names';
import type { LiveAutoGroup } from './liveGroupsOf';

type Params = {
  readonly group: LiveAutoGroup;
};

export const liveAutoNameOf = ({ group }: Params): string => {
  const { title } = group.group;
  const isGeneric = title === null || title.toLowerCase() === 'auto';
  return isGeneric ? NAMES.runKind.autoAgent : title;
};
