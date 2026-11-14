import { useAppStore } from '../../store';
import type { StartWorkSeed } from '../../store/slices/work/state';

type Params = {
  readonly seed: StartWorkSeed;
};

export const openStartWork = ({ seed }: Params): void => {
  const state = useAppStore.getState();
  state.openWorkStart({ seed });
  state.openStudio({ studio: { kind: 'work' } });
};
