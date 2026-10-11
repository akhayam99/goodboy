import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';

type OutcomeRun = {
  readonly isBusy: boolean;
  readonly error: string | null;
  readonly run: (step: () => Promise<void>) => Promise<boolean>;
};

export const useOutcomeRun = (): OutcomeRun => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (step: () => Promise<void>): Promise<boolean> => {
      if (isBusy) {
        return false;
      }
      setIsBusy(true);
      setError(null);
      try {
        await step();
        return true;
      } catch (caught) {
        if (!isReportedError(caught)) {
          setError(formatError(caught));
        }
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy],
  );

  return { isBusy, error, run };
};
