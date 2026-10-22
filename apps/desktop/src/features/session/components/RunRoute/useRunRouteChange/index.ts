import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { RunRouteShape, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  changeRunRoute,
  type RunRouteChoice,
  type RunRouteTarget,
} from '../../../startRun/changeRunRoute';
import { changeRunDefault } from '../../../startRun/changeRunDefault';
import { RUN_ROUTE_COPY } from '../../../startRun/runRouteCopy';

type Params = {
  readonly target: RunRouteTarget;
};

type DefaultParams = {
  readonly sessionId: SessionId;
  readonly shape: RunRouteShape;
};

export type RunRouteChangeModel = Readonly<{
  isBusy: boolean;
  error: string | null;
  choose: (choice: RunRouteChoice) => Promise<void>;
  setSessionDefault: (params: DefaultParams) => Promise<void>;
}>;

export const useRunRouteChange = ({ target }: Params): RunRouteChangeModel => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportError = useAppStore((state) => state.reportError);

  const choose = useCallback(
    async (choice: RunRouteChoice): Promise<void> => {
      setIsBusy(true);
      setError(null);
      try {
        await changeRunRoute({ target, choice });
      } catch (cause) {
        setError(formatError(cause));
      } finally {
        setIsBusy(false);
      }
    },
    [target],
  );

  const setSessionDefault = useCallback(
    async ({ sessionId, shape }: DefaultParams): Promise<void> => {
      try {
        await changeRunDefault({ scope: { kind: 'session', sessionId }, shape });
      } catch (cause) {
        void reportError({ title: RUN_ROUTE_COPY.changeFailed, error: cause, sessionId });
      }
    },
    [reportError],
  );

  return { isBusy, error, choose, setSessionDefault };
};
