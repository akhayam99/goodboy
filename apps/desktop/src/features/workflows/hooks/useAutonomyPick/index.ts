import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkflowAutonomy } from '@goodboy/types';

type SaveParams = {
  readonly next: WorkflowAutonomy;
};

type Params = {
  readonly current: WorkflowAutonomy;
  readonly save: (params: SaveParams) => Promise<void>;
};

export const useAutonomyPick = ({ current, save }: Params) => {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const pick = async ({ next }: SaveParams) => {
    if (next === current || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await save({ next });
    } catch (failure) {
      setError(`Couldn't change it. ${formatError(failure)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return { error, isBusy, pick };
};
