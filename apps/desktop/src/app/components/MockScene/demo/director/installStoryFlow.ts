import type { DirectorStore } from './directorTypes';
import { installStoryDirection } from './installStoryDirection';
import { installStoryPlan } from './installStoryPlan';

type Params = {
  readonly store: DirectorStore;
};

export const installStoryFlow = ({ store }: Params): void => {
  installStoryDirection({ store });
  installStoryPlan({ store });
};
