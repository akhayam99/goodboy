import { formatError } from '@goodboy/ui';
import type { ActionEnv } from '../actions/types';

type RunParams = {
  readonly actionId: string;
};

type Params = {
  readonly actionId: string;
  readonly run: (params: RunParams) => Promise<void>;
  readonly env: ActionEnv;
};

export const runVerb = async ({ actionId, run, env }: Params): Promise<void> => {
  try {
    await run({ actionId });
  } catch (error) {
    env.showToast({ kind: 'warning', title: "Couldn't finish that", message: formatError(error) });
  }
};
