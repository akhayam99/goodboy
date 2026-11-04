import {
  describeAutoRefusal,
  type AutoRefusalCode,
  type MountNote,
  type RefusalChild,
} from '@goodboy/core/auto';
import type { BridgeOutcome } from './ports';

type RefuseParams = {
  readonly code: AutoRefusalCode;
  readonly message?: string;
  readonly perChild?: ReadonlyArray<RefusalChild>;
  readonly mount?: MountNote;
};

export const refuseOutcome = ({ code, message, perChild, mount }: RefuseParams): BridgeOutcome => ({
  isOk: false,
  code,
  error: describeAutoRefusal({
    code,
    ...(message === undefined ? {} : { message }),
    ...(perChild === undefined ? {} : { perChild }),
  }),
  ...(mount === undefined ? {} : { mount }),
});
