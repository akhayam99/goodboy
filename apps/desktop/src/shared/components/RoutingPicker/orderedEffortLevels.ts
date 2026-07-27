import { EFFORT_LEVELS, type EffortLevel } from '../../../features/chat/utils/chat-constants';

type Params = {
  readonly levels: ReadonlyArray<EffortLevel>;
};

export const orderedEffortLevels = ({ levels }: Params): ReadonlyArray<EffortLevel> =>
  EFFORT_LEVELS.filter((level) => levels.includes(level));
