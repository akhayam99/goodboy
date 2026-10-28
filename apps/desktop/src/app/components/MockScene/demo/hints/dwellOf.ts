import type { DemoHint } from './demoHintTypes';
import { RESULT_DWELL_MS } from './resultDwellMs';

type Params = {
  readonly hint: DemoHint;
};

export const dwellOf = ({ hint }: Params): number => hint.dwellMs ?? RESULT_DWELL_MS;
