import { cancelLimitContinue } from './cancelLimitContinue';
import { clearAgentLimitStops } from './clearAgentLimitStops';
import { continueAfterLimit } from './continueAfterLimit';
import { recordLimitStop } from './recordLimitStop';
import { limitStopsInitialState } from './state';
import type { LimitStopsSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export const createLimitStopsSlice = ({ set, get }: SliceDeps): LimitStopsSlice => ({
  ...limitStopsInitialState,
  recordLimitStop: recordLimitStop({ set, get }),
  continueAfterLimit: continueAfterLimit({ set, get }),
  cancelLimitContinue: cancelLimitContinue({ set, get }),
  clearAgentLimitStops: clearAgentLimitStops({ set, get }),
});
