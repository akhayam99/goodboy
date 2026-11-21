import { failingTestOf } from '../../../features/suggestions/signals/failingTestOf';
import { isTimeoutLog } from '../../../features/suggestions/signals/isTimeoutLog';

type Params = {
  readonly log: string;
};

type Parsed = {
  readonly testFile: string | null;
  readonly testName: string | null;
  readonly isTimeout: boolean;
  readonly lines: ReadonlyArray<string>;
};

const SHOWN_LINES = 12;

export const parseCheckLog = ({ log }: Params): Parsed => {
  const test = failingTestOf({ log });
  const lines = log
    .replace(/\u001B\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '');
  return {
    testFile: test?.file ?? null,
    testName: test?.name ?? null,
    isTimeout: isTimeoutLog({ log }),
    lines: lines.slice(-SHOWN_LINES),
  };
};
