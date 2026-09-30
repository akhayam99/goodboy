import { useCallback, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useActionEnv } from '../useActionEnv';
import { useObjectActions } from '../useObjectActions';
import type { ActionSlot, ObjectTarget, ResolvedAction } from '../types';

type Params = {
  readonly target: ObjectTarget | null;
  readonly anchorKey?: string | null;
};

type ActionFailure = {
  readonly actionId: string;
  readonly message: string;
};

export type ActionControls = {
  readonly target: ObjectTarget | null;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly inSlot: (params: { readonly slot: ActionSlot }) => ReadonlyArray<ResolvedAction>;
  readonly pendingId: string | null;
  readonly confirming: ResolvedAction | null;
  readonly failure: ActionFailure | null;
  readonly trigger: (params: { readonly actionId: string }) => void;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
  readonly retry: () => void;
};

export const useActionControls = ({ target, anchorKey = null }: Params): ActionControls => {
  const env = useActionEnv({ origin: 'button', anchorKey });
  const { actions, run } = useObjectActions({ target, env });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  const execute = useCallback(
    async ({ actionId }: { readonly actionId: string }) => {
      setFailure(null);
      setPendingId(actionId);
      try {
        await run({ actionId });
      } catch (error) {
        setFailure({ actionId, message: formatError(error) });
      } finally {
        setPendingId(null);
      }
    },
    [run],
  );

  const trigger = useCallback(
    ({ actionId }: { readonly actionId: string }) => {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action === undefined || action.blockedReason !== null || pendingId !== null) {
        return;
      }
      if (action.confirm !== null) {
        setFailure(null);
        setConfirmingId(actionId);
        return;
      }
      void execute({ actionId });
    },
    [actions, execute, pendingId],
  );

  const confirming = useMemo(
    () =>
      confirmingId === null
        ? null
        : (actions.find(
            (candidate) => candidate.id === confirmingId && candidate.confirm !== null,
          ) ?? null),
    [actions, confirmingId],
  );

  const confirm = useCallback(async () => {
    if (confirming === null) {
      return;
    }
    const actionId = confirming.id;
    setConfirmingId(null);
    await execute({ actionId });
  }, [confirming, execute]);

  const cancel = useCallback(() => setConfirmingId(null), []);

  const retry = useCallback(() => {
    if (failure !== null) {
      void execute({ actionId: failure.actionId });
    }
  }, [execute, failure]);

  const inSlot = useCallback(
    ({ slot }: { readonly slot: ActionSlot }) => actions.filter((action) => action.slot === slot),
    [actions],
  );

  return {
    target,
    actions,
    inSlot,
    pendingId,
    confirming,
    failure,
    trigger,
    confirm,
    cancel,
    retry,
  };
};
