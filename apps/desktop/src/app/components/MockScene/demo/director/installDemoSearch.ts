import type { DirectorStore } from './directorTypes';
import { runDemoSearch } from './runDemoSearch';

type Params = {
  readonly store: DirectorStore;
};

export const installDemoSearch = ({ store }: Params): void => {
  const sessionCount = store.getState().sessions.length;
  store.setState({
    runSearch: async ({ query }) => runDemoSearch({ state: store.getState(), query }),
    loadSearchIndexStatus: async () => undefined,
    searchIndexStatus: {
      docs: sessionCount * 40,
      bytes: sessionCount * 120_000,
      scanned: sessionCount,
      total: sessionCount,
      isBackfillDone: true,
      excludedProjectIds: [],
    },
  });
};
