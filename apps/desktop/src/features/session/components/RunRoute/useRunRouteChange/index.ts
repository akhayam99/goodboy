import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import {
  changeRunRoute,
  type RunRouteChange,
  type RunRouteChoice,
  type RunRouteTarget,
} from '../../../startRun/changeRunRoute';

type Params = {
  readonly target: RunRouteTarget;
};

type ChooseParams = {
  readonly choice: RunRouteChoice;
};

export type RunRouteChangeModel = Readonly<{
  isBusy: boolean;
  error: string | null;
  choose: (params: ChooseParams) => Promise<RunRouteChange | null>;
}>;

export const useRunRouteChange = ({ target }: Params): RunRouteChangeModel => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    async ({ choice }: ChooseParams): Promise<RunRouteChange | null> => {
      setIsBusy(true);
      setError(null);
      try {
        return await changeRunRoute({ target, choice });
      } catch (cause) {
        setError(formatError(cause));
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [target],
  );

  return { isBusy, error, choose };
};
