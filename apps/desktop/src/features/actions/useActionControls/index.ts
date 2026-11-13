import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useActionRun, useAppStore } from '../../../store';
import { hasActionRunSurface } from '../../../store/slices/action-runs/hasActionRunSurface';
import { selectActionRun } from '../../../store/slices/action-runs/selectActionRun';
import type { Place } from '../../../store/slices/navigation/types';
import { useNow } from '../../../shared/hooks/useNow';
import { actionRunKeyOf } from '../actionRunKeyOf';
import { pendingSecondsOf } from '../pendingSecondsOf';
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

type ActionOutcome = {
  readonly actionId: string;
  readonly message: string;
  readonly place?: Place;
};

type ConfirmParams = {
  readonly choice?: string | null;
  readonly insteadId?: string;
};

type ExecuteParams = {
  readonly actionId: string;
  readonly choice?: string | null;
};

export type ActionControls = {
  readonly target: ObjectTarget | null;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly inSlot: (params: { readonly slot: ActionSlot }) => ReadonlyArray<ResolvedAction>;
  readonly pendingId: string | null;
  readonly pendingSeconds: number | null;
  readonly confirming: ResolvedAction | null;
  readonly failure: ActionFailure | null;
  readonly outcome: ActionOutcome | null;
  readonly trigger: (params: { readonly actionId: string }) => void;
  readonly confirm: (params?: ConfirmParams) => Promise<void>;
  readonly cancel: () => void;
  readonly retry: () => void;
  readonly dismissFailure: () => void;
  readonly dismissOutcome: () => void;
};

type DoneToOfParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly actionId: string;
};

const doneToOf = ({ actions, actionId }: DoneToOfParams): { readonly place?: Place } => {
  const place = actions.find((candidate) => candidate.id === actionId)?.doneTo;
  return place === undefined ? {} : { place };
};

export const useActionControls = ({
  target,
  anchorKey = null,
  scopeKey = null,
}: Params): ActionControls => {
  const instanceId = useId();
  const sharedKey = target === null ? null : actionRunKeyOf({ target });
  const runKey = target === null ? null : (sharedKey ?? `instance:${instanceId}:${scopeKey ?? ''}`);
  const sessionId = target !== null && 'sessionId' in target ? target.sessionId : null;
  const hasRunSurface = useCallback(
    () => hasActionRunSurface({ state: useAppStore.getState(), key: runKey }),
    [runKey],
  );
  const env = useActionEnv({ origin: 'button', anchorKey, isOutcomeShown: true, hasRunSurface });
  const { actions, runWithOutcome } = useObjectActions({ target, env });
  const run = useActionRun({ key: runKey });
  const pending = run !== null && run.phase === 'pending' ? run : null;
  const now = useNow(1_000, pending !== null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    setConfirmingId(null);
  }, [scopeKey]);

  useEffect(() => {
    if (runKey === null) {
      return undefined;
    }
    useAppStore.getState().attachActionRunSurface({ key: runKey });
    return () => {
      const store = useAppStore.getState();
      store.detachActionRunSurface({ key: runKey });
      if (sharedKey === null) {
        store.dropActionRun({ key: runKey });
      }
    };
  }, [runKey, sharedKey]);

  const isPendingNow = useCallback(
    () => selectActionRun({ state: useAppStore.getState(), key: runKey })?.phase === 'pending',
    [runKey],
  );

  const execute = useCallback(
    async ({ actionId, choice = null }: ExecuteParams) => {
      if (runKey === null) {
        return;
      }
      const doneLabel = actions.find((candidate) => candidate.id === actionId)?.doneLabel ?? null;
      await useAppStore.getState().runAction({
        key: runKey,
        sessionId,
        actionId,
        choice,
        task: async () => {
          const result = await runWithOutcome({ actionId, choice });
          return doneLabel !== null && result === 'done' ? doneLabel : null;
        },
      });
    },
    [actions, runKey, runWithOutcome, sessionId],
  );

  const dismiss = useCallback(() => {
    if (runKey !== null) {
      useAppStore.getState().dismissActionRun({ key: runKey });
    }
  }, [runKey]);

  const trigger = useCallback(
    ({ actionId }: { readonly actionId: string }) => {
      const action = actions.find((candidate) => candidate.id === actionId);
      if (action === undefined || action.blockedReason !== null || isPendingNow()) {
        return;
      }
      if (action.confirm !== null) {
        dismiss();
        setConfirmingId(actionId);
        return;
      }
      void execute({ actionId });
    },
    [actions, dismiss, execute, isPendingNow],
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
    async (params?: ConfirmParams) => {
      if (confirming === null) {
        return;
      }
      const insteadId = params?.insteadId;
      const instead =
        insteadId === undefined
          ? null
          : actions.find(
              (candidate) => candidate.id === insteadId && candidate.blockedReason === null,
            );
      if (instead === undefined) {
        return;
      }
      if (isPendingNow()) {
        return;
      }
      const actionId = instead === null ? confirming.id : instead.id;
      setConfirmingId(null);
      await execute({ actionId, choice: params?.choice ?? null });
    },
    [actions, confirming, execute, isPendingNow],
  );

  const cancel = useCallback(() => setConfirmingId(null), []);

  const failure = useMemo<ActionFailure | null>(
    () =>
      run === null || run.phase !== 'failed'
        ? null
        : {
            actionId: run.actionId,
            message: run.message ?? '',
            error: run.error,
            choice: run.choice,
          },
    [run],
  );

  const outcome = useMemo<ActionOutcome | null>(
    () =>
      run === null || run.phase !== 'done' || run.message === null
        ? null
        : {
            actionId: run.actionId,
            message: run.message,
            ...doneToOf({ actions, actionId: run.actionId }),
          },
    [actions, run],
  );

  const retry = useCallback(() => {
    if (failure !== null) {
      void execute({ actionId: failure.actionId, choice: failure.choice });
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
    pendingId: pending?.actionId ?? null,
    pendingSeconds: pendingSecondsOf({ startedAt: pending?.startedAt ?? null, now }),
    confirming,
    failure,
    outcome,
    trigger,
    confirm,
    cancel,
    retry,
    dismissFailure: dismiss,
    dismissOutcome: dismiss,
  };
};
