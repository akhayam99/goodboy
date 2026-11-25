import type { SessionProjectMount } from '@goodboy/types';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { projectLineOf } from './projectLineOf';

type Params = {
  readonly mounts: ReadonlyArray<Pick<SessionProjectMount, 'mountName' | 'branch'>>;
};

export const cardContextOf = ({ mounts }: Params): string =>
  joinFacts({ facts: [projectLineOf({ mounts }), mounts[0]?.branch] });
