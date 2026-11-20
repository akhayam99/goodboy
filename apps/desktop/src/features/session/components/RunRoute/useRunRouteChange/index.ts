import { useCallback, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import {
  changeRunRoute,
  type RunRouteChange,
  type RunRouteChoice,
  type RunRouteTarget,
} from '../../../startRun/changeRunRoute';
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

type ChangeOnceParams = ChooseParams & Params;

const changeOnce = async ({
  target,
  choice,
  shouldEndRun = false,
}: ChangeOnceParams): Promise<RunRouteChange | null> => {
  try {
    return await changeRunRoute({ target, choice, shouldEndRun });
  } catch (error) {
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
