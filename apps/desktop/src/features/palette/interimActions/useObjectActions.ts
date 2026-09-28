import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '../../../store';
import { bindTarget, runObjectAction } from './registry';
import type { ActionEnv, ObjectTarget, ResolvedAction } from './types';

type Params = {
  readonly target: ObjectTarget | null;
  readonly env: ActionEnv;
};

type RunParams = {
  readonly actionId: string;
};

export type ObjectActions = {
  readonly noun: string | null;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly run: (params: RunParams) => Promise<void>;
};

type Snapshot = {
  readonly signature: string;
  readonly noun: string | null;
  readonly actions: ReadonlyArray<ResolvedAction>;
};

const EMPTY: Snapshot = { signature: '', noun: null, actions: [] };

const signatureOf = (actions: ReadonlyArray<ResolvedAction>): string =>
  JSON.stringify(
    actions.map(({ id, label, blockedReason, confirm, isUndoable }) => [
      id,
      label,
      blockedReason,
      confirm,
      isUndoable,
    ]),
  );

export const useObjectActions = ({ target, env }: Params): ObjectActions => {
  const cache = useRef<{ readonly target: ObjectTarget | null; readonly snapshot: Snapshot }>({
    target: null,
    snapshot: EMPTY,
  });

  const getSnapshot = useCallback((): Snapshot => {
    const bound = target === null ? null : bindTarget({ state: useAppStore.getState(), target });
    const actions = bound?.resolve() ?? [];
    const signature = `${bound?.noun ?? ''}:${signatureOf(actions)}`;
    const previous = cache.current;
    if (previous.target === target && previous.snapshot.signature === signature) {
      return previous.snapshot;
    }
    const snapshot = { signature, noun: bound?.noun ?? null, actions };
    cache.current = { target, snapshot };
    return snapshot;
  }, [target]);

  const snapshot = useSyncExternalStore(useAppStore.subscribe, getSnapshot, getSnapshot);

  const run = useCallback(
    async ({ actionId }: RunParams) => {
      if (target === null) {
        return;
      }
      await runObjectAction({ target, actionId, env });
    },
    [env, target],
  );

  return { noun: snapshot.noun, actions: snapshot.actions, run };
};
