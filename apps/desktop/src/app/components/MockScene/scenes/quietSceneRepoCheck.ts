import { useAppStore } from '../../../../store';

export const quietSceneRepoCheck = (): void => {
  useAppStore.setState({ checkRepoDivergence: async () => 'skipped' });
};
