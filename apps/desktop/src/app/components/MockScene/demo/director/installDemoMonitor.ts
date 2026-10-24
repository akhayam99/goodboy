import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

export const installDemoMonitor = ({ store }: Params): void => {
  if (store.getState().monitorSnapshot !== null) {
    return;
  }
  store.setState({
    monitorSnapshot: {
      listeners: [],
      processes: [],
      takenAt: Date.now(),
      isPlatformSupported: true,
    },
  });
};
