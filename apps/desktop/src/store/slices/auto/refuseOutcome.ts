import { describeAutoRefusal, type AutoRefusalCode, type RefusalChild } from '@goodboy/core';
import type { BridgeOutcome } from './ports';

type RefuseParams = {
  readonly code: AutoRefusalCode;
  readonly message?: string;
  readonly perChild?: ReadonlyArray<RefusalChild>;
};

export const refuseOutcome = ({ code, message, perChild }: RefuseParams): BridgeOutcome => ({
  isOk: false,
  code,
  error: describeAutoRefusal({
    code,
    ...(message === undefined ? {} : { message }),
    ...(perChild === undefined ? {} : { perChild }),
  }),
});
