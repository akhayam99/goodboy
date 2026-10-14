import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { createLatestOnly } from '../../../store/slices/state-writes/latestOnly';
import { useActionEnv } from '../useActionEnv';
import { useObjectActions } from '../useObjectActions';
import type { ActionSlot, ObjectTarget, ResolvedAction } from '../types';

type Params = {
  readonly target: ObjectTarget | null;
  readonly anchorKey?: string | null;
  readonly scopeKey?: string | null;
};

type ActionFailure = {
  readonly actionId: string;
  readonly message: string;
  readonly error: unknown;
  readonly choice: string | null;
};

const RUN_KEY = 'action';

type ActionOutcome = {
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
  readonly outcome: ActionOutcome | null;
  readonly trigger: (params: { readonly actionId: string }) => void;
  readonly confirm: (params?: { readonly choice?: string | null }) => Promise<void>;
  readonly cancel: () => void;
  readonly retry: () => void;
  readonly dismissFailure: () => void;
  readonly dismissOutcome: () => void;
};

export const useActionControls = ({
  target,
  anchorKey = null,
  scopeKey = null,
}: Params): ActionControls => {
  const env = useActionEnv({ origin: 'button', anchorKey });
  const { actions, runWithOutcome } = useObjectActions({ target, env });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);
  const isRunningRef = useRef(false);
  const latest = useRef(createLatestOnly());

  useEffect(() => {
    latest.current.cancel({ key: RUN_KEY });
    isRunningRef.current = false;
    setPendingId(null);
    setConfirmingId(null);
    setFailure(null);
    setOutcome(null);
  }, [scopeKey]);

  const execute = useCallback(
    async ({
      actionId,
      choice = null,
    }: {
      readonly actionId: string;
      readonly choice?: string | null;
    }) => {
      if (isRunningRef.current) {
        return;
      }
      const doneLabel = actions.find((candidate) => candidate.id === actionId)?.doneLabel ?? null;
      isRunningRef.current = true;
      setFailure(null);
      setOutcome(null);
      setPendingId(actionId);
      try {
        const status = await latest.current.run({
          key: RUN_KEY,
          request: () => runWithOutcome({ actionId, choice }),
          apply: (result) => {
            if (doneLabel !== null && result === 'done') {
              setOutcome({ actionId, message: doneLabel });
            }
          },
        });
        if (status === 'stale') {
          return;
        }
      } catch (error) {
        setFailure({ actionId, message: formatError(error), error, choice });
      }
      isRunningRef.current = false;
      setPendingId(null);
    },
    [actions, runWithOutcome],
  );

  const trigger = useCallback(
    ({ actionId }: { readonly actionId: string }) => {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action === undefined || action.blockedReason !== null || isRunningRef.current) {
        return;
      }
      if (action.confirm !== null) {
        setFailure(null);
        setConfirmingId(actionId);
        return;
      }
      void execute({ actionId });
    },
    [actions, execute],
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

  const confirm = useCallback(
    async (params?: { readonly choice?: string | null }) => {
      if (confirming === null) {
        return;
      }
      const actionId = confirming.id;
      setConfirmingId(null);
      await execute({ actionId, choice: params?.choice ?? null });
    },
    [confirming, execute],
  );

  const cancel = useCallback(() => setConfirmingId(null), []);

  const retry = useCallback(() => {
    if (failure !== null) {
      void execute({ actionId: failure.actionId, choice: failure.choice });
    }
  }, [execute, failure]);

  const dismissFailure = useCallback(() => setFailure(null), []);
  const dismissOutcome = useCallback(() => setOutcome(null), []);

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
    outcome,
    trigger,
    confirm,
    cancel,
    retry,
    dismissFailure,
    dismissOutcome,
  };
};
