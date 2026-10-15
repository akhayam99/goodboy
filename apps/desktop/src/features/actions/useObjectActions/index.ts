import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '../../../store';
import { bindTarget, runObjectActionWithOutcome, type BoundObject } from '../registry';
import { isSameFacts } from '../isSameFacts';
import type { ActionEnv, ActionRunOutcome, ObjectTarget, ResolvedAction } from '../types';

type Params = {
  readonly target: ObjectTarget | null;
  readonly env: ActionEnv;
};

type RunParams = {
  readonly actionId: string;
  readonly choice?: string | null;
};

export type ObjectActions = {
  readonly noun: string | null;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly run: (params: RunParams) => Promise<void>;
  readonly runWithOutcome: (params: RunParams) => Promise<ActionRunOutcome>;
};

type Snapshot = {
  readonly target: ObjectTarget | null;
  readonly bound: BoundObject | null;
};

const isSameTarget = (a: ObjectTarget | null, b: ObjectTarget | null): boolean =>
  isSameFacts({ previous: a, next: b });

export const useObjectActions = ({ target, env }: Params): ObjectActions => {
  const snapshot = useRef<Snapshot>({ target: null, bound: null });

  const getSnapshot = useCallback((): BoundObject | null => {
    const next = target === null ? null : bindTarget({ state: useAppStore.getState(), target });
    const previous = snapshot.current;
    if (
      isSameTarget(previous.target, target) &&
      isSameFacts({ previous: previous.bound?.facts ?? null, next: next?.facts ?? null })
    ) {
      return previous.bound;
    }
    snapshot.current = { target, bound: next };
    return next;
  }, [target]);

  const bound = useSyncExternalStore(useAppStore.subscribe, getSnapshot, getSnapshot);
  const viewing = env.viewing;
  const actions = useMemo(() => bound?.resolve({ viewing }) ?? [], [bound, viewing]);

  const runWithOutcome = useCallback(
    async ({ actionId, choice = null }: RunParams): Promise<ActionRunOutcome> => {
      if (target === null) {
        return 'unchanged';
      }
      return runObjectActionWithOutcome({ target, actionId, env, choice });
    },
    [env, target],
  );

  const run = useCallback(
    async (params: RunParams) => {
      await runWithOutcome(params);
    },
    [runWithOutcome],
  );

  return { noun: bound?.noun ?? null, actions, run, runWithOutcome };
};
