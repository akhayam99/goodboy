import type { AppStore } from '../../../../../store/store';
import type { StorageRemovalSummary } from '../../../../../store/slices/storage/types';
import { demoRuns } from './demoRunRegistry';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
};

type PathsParams = {
  readonly paths: ReadonlyArray<string>;
};

const REMOVE_MS = 900;

const markRemoving = ({ store, paths }: Params & PathsParams): void => {
  store.setState((state) => ({
    storageRemovingPaths: {
      ...state.storageRemovingPaths,
      ...Object.fromEntries(paths.map((path) => [path, true])),
    },
  }));
};

const clearRemoving = ({ store, paths }: Params & PathsParams): void => {
  store.setState((state) => ({
    storageRemovingPaths: Object.fromEntries(
      Object.entries(state.storageRemovingPaths).filter(([path]) => !paths.includes(path)),
    ),
  }));
};

export const installStorageActions = ({ store }: Params): void => {
  const removeStorageFolders: AppStore['removeStorageFolders'] = ({ paths }) =>
    new Promise<StorageRemovalSummary>((resolve, reject) => {
      const folders = store
        .getState()
        .storageFolders.filter((folder) => paths.includes(folder.path));
      const removed = folders.map((folder) => folder.path);
      markRemoving({ store, paths: removed });
      let untrack = (): void => undefined;
      const timer = window.setTimeout(() => {
        untrack();
        const summary: StorageRemovalSummary = {
          removed: folders.length,
          freedBytes: folders.reduce((sum, folder) => sum + (folder.sizeBytes ?? 0), 0),
          kept: [],
          restorable: [],
          undo: null,
          isUndoing: false,
        };
        clearRemoving({ store, paths: removed });
        store.setState((state) => ({
          storageFolders: state.storageFolders.filter((folder) => !removed.includes(folder.path)),
          storageOutcome: summary,
        }));
        resolve(summary);
      }, REMOVE_MS);
      untrack = demoRuns.track({
        cancel: () => {
          window.clearTimeout(timer);
          clearRemoving({ store, paths: removed });
          reject(new Error('The removal was cancelled'));
        },
      });
    });
  store.setState({ removeStorageFolders });
};
