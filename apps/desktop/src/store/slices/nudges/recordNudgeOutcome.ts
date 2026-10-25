import type { NudgeOutcome } from '@goodboy/db';
import { recordOutcome } from './recordOutcome';

type Params = {
  readonly id: string;
  readonly outcome: NudgeOutcome;
};

export const recordNudgeOutcome = ({ id, outcome }: Params): Promise<void> =>
  recordOutcome(id, outcome);
