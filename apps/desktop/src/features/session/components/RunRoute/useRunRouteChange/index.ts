import { useCallback, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  CHECK_STATE,
  NOTHING_CHANGED,
} from '../../../../../store/slices/notifications/errorRecovery';
import type {
  RunRouteChange,
  RunRouteChoice,
  RunRouteTarget,
} from '../../../startRun/changeRunRoute';
import { OldRunLeftError } from '../../../startRun/OldRunLeftError';
import { RUN_ROUTE_COPY } from '../../../startRun/runRouteCopy';

type Params = {
  readonly target: RunRouteTarget;
};

type ChooseParams = {
  readonly choice: RunRouteChoice;
  readonly shouldEndRun?: boolean;
};

export type RunRouteChangeModel = Readonly<{
  isBusy: boolean;
  choose: (params: ChooseParams) => Promise<RunRouteChange | null>;
}>;

type EndOnceParams = {
  readonly sessionId: SessionId;
  readonly endOldRun: OldRunLeftError['endOldRun'];
};

type ReportLeftParams = EndOnceParams & {
  readonly error: unknown;
};

const reportOldRunLeft = ({ sessionId, endOldRun, error }: ReportLeftParams): void => {
  void useAppStore.getState().reportError({
    title: RUN_ROUTE_COPY.oldRunLeft,
    error,
    recovery: CHECK_STATE,
    stays: RUN_ROUTE_COPY.newRunKept,
    sessionId,
    retry: () => endOnce({ sessionId, endOldRun }),
  });
};

const endOnce = async ({ sessionId, endOldRun }: EndOnceParams): Promise<boolean> => {
  try {
    await endOldRun();
    return true;
  } catch (error) {
    reportOldRunLeft({ sessionId, endOldRun, error });
    return false;
  }
};

type ChangeOnceParams = ChooseParams & Params;

const changeOnce = async ({
  target,
  choice,
  shouldEndRun = false,
}: ChangeOnceParams): Promise<RunRouteChange | null> => {
  try {
    const { changeRunRoute } = await import('../../../startRun/changeRunRoute');
    return await changeRunRoute({ target, choice, shouldEndRun });
  } catch (error) {
    if (error instanceof OldRunLeftError) {
      reportOldRunLeft({
        sessionId: target.sessionId,
        endOldRun: error.endOldRun,
        error: error.failure,
      });
      return 'second-run';
    }
    void useAppStore.getState().reportError({
      title: RUN_ROUTE_COPY.changeFailed,
      error,
      recovery: NOTHING_CHANGED,
      sessionId: target.sessionId,
      retry: async () => (await changeOnce({ target, choice, shouldEndRun })) !== null,
    });
    return null;
  }
};

export const useRunRouteChange = ({ target }: Params): RunRouteChangeModel => {
  const [isBusy, setIsBusy] = useState(false);

  const choose = useCallback(
    async ({ choice, shouldEndRun = false }: ChooseParams): Promise<RunRouteChange | null> => {
      setIsBusy(true);
      try {
        return await changeOnce({ target, choice, shouldEndRun });
      } finally {
        setIsBusy(false);
      }
    },
    [target],
  );

  return { isBusy, choose };
};
