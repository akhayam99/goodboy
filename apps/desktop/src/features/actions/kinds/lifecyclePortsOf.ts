import type { ActionEnv } from '../types';

type Params = {
  readonly env: ActionEnv;
};

export const lifecyclePortsOf = ({ env }: Params) => ({
  bulkArchiveTask: env.getState().bulkArchiveTask,
  bulkUnarchiveTask: env.getState().bulkUnarchiveTask,
  showToast: env.showToast,
});
