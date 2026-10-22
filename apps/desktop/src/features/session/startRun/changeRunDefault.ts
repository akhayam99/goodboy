import { useAppStore } from '../../../store';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  parseRunDefault,
  runDefaultKey,
  writeRunDefault,
  type RunDefault,
  type RunDefaultScope,
} from './runDefaultSetting';
import { RUN_ROUTE_COPY } from './runRouteCopy';

type Params = {
  readonly scope: RunDefaultScope;
  readonly shape: RunDefault;
};

type ReadParams = {
  readonly key: string;
};

const storedDefaultOf = async ({ key }: ReadParams): Promise<RunDefault | null> =>
  parseRunDefault({ raw: await useAppStore.getState().loadSetting(key) });

type RestoreParams = {
  readonly key: string;
  readonly scope: RunDefaultScope;
  readonly shape: RunDefault;
  readonly previous: RunDefault | null;
};

const restoreDefault = async ({ key, scope, shape, previous }: RestoreParams): Promise<boolean> => {
  if (previous === null) {
    return useAppStore.getState().removeSettingIfUnchanged({ key, expected: shape });
  }
  await writeRunDefault({ db: tauriDatabase, scope, shape: previous });
  await useAppStore.getState().loadSetting(key);
  return true;
};

export const changeRunDefault = async ({ scope, shape }: Params): Promise<void> => {
  const key = runDefaultKey({ scope });
  const previous = await storedDefaultOf({ key });
  const isWorkspaceAuto = scope.kind === 'workspace' && previous === null && shape === 'auto';
  if (previous === shape || isWorkspaceAuto) {
    return;
  }
  await writeRunDefault({ db: tauriDatabase, scope, shape });
  await useAppStore.getState().loadSetting(key);
  useAppStore.getState().undoable({
    message: RUN_ROUTE_COPY.defaultSaved({ name: RUN_ROUTE_COPY.defaults[shape] }),
    conflictMessage: RUN_ROUTE_COPY.defaultChanged,
    undo: async () => {
      if ((await storedDefaultOf({ key })) !== shape) {
        return false;
      }
      return restoreDefault({ key, scope, shape, previous });
    },
  });
};
