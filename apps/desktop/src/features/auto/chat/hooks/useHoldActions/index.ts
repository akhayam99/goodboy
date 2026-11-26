import { useCallback, useState } from 'react';
import { brandId, type Agent, type SessionId, type WorkflowId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import {
  CHECK_STATE,
  NOTHING_CHANGED,
} from '../../../../../store/slices/notifications/errorRecovery';
import { OldRunLeftError } from '../../../../session/startRun/OldRunLeftError';
import { RUN_ROUTE_COPY } from '../../../../session/startRun/runRouteCopy';
import { switchHeldRun } from '../../../../session/startRun/switchHeldRun';
import { AUTO_STARTING_SENTENCE } from '../../../autoStartingSentence';
import { currentAutoUserTurnPort } from '../../../autoUserTurnPort';

type Params = {
  readonly sessionId: SessionId;
  readonly rootAgent: Agent;
  readonly suggestionId: string | null;
  readonly workflowName: string;
  readonly holdKey: string;
};

export type HoldBusy = 'switch' | 'continue' | null;

export type HoldActions = Readonly<{
  busy: HoldBusy;
  switchRun: () => Promise<void>;
  continueRun: () => Promise<void>;
}>;

type ReportParams = {
  readonly sessionId: SessionId;
  readonly error: unknown;
  readonly retry: () => Promise<boolean>;
};

const reportFailure = ({ sessionId, error, retry }: ReportParams): void => {
  if (error instanceof OldRunLeftError) {
    void useAppStore.getState().reportError({
      title: RUN_ROUTE_COPY.oldRunLeft,
      error: error.failure,
      recovery: CHECK_STATE,
      stays: RUN_ROUTE_COPY.newRunKept,
      sessionId,
      retry: async () => {
        try {
          await error.endOldRun();
          return true;
        } catch {
          return false;
        }
      },
    });
    return;
  }
  void useAppStore.getState().reportError({
    title: RUN_ROUTE_COPY.changeFailed,
    error,
    recovery: NOTHING_CHANGED,
    sessionId,
    retry,
  });
};

type RunParams = {
  readonly kind: Exclude<HoldBusy, null>;
  readonly work: () => Promise<void>;
};

export const useHoldActions = ({
  sessionId,
  rootAgent,
  suggestionId,
  workflowName,
  holdKey,
}: Params): HoldActions => {
  const [busy, setBusy] = useState<HoldBusy>(null);

  const run = useCallback(
    async ({ kind, work }: RunParams): Promise<boolean> => {
      setBusy(kind);
      try {
        await work();
        return true;
      } catch (error) {
        reportFailure({
          sessionId,
          error,
          retry: () => run({ kind, work }),
        });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [sessionId],
  );

  const switchRun = useCallback(async (): Promise<void> => {
    if (suggestionId === null) {
      return;
    }
    await run({
      kind: 'switch',
      work: () =>
        switchHeldRun({
          sessionId,
          agentId: rootAgent.id,
          workflowId: brandId<WorkflowId>({ value: suggestionId }),
        }),
    });
  }, [run, sessionId, rootAgent.id, suggestionId]);

  const continueRun = useCallback(async (): Promise<void> => {
    await run({
      kind: 'continue',
      work: async () => {
        const port = currentAutoUserTurnPort();
        if (port === null) {
          throw new Error(AUTO_STARTING_SENTENCE);
        }
        const session = sessionById(useAppStore.getState().sessions, sessionId);
        if (session === undefined || session === null) {
          throw new Error('This session is no longer here');
        }
        const result = await port({
          agentId: rootAgent.id,
          sessionId,
          workspaceId: session.workspaceId,
          text: `Continue with ${workflowName}. Go on past the first check.`,
          deliveryId: `hold-continue:${holdKey}`,
          origin: 'continue',
        });
        if (result === 'lost') {
          throw new Error('This run is no longer here');
        }
      },
    });
  }, [run, sessionId, rootAgent.id, workflowName, holdKey]);

  return { busy, switchRun, continueRun };
};
