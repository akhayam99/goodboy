import { waitForIdle } from '../search-index/scheduleIdle';

type Params = {
  readonly tasks: ReadonlyArray<() => void>;
};

export const runEachOnIdle = async ({ tasks }: Params): Promise<void> => {
  for (const task of tasks) {
    await waitForIdle();
    task();
  }
};
