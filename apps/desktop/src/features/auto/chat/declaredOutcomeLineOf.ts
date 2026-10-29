import type { OutcomeLine } from '@goodboy/core';
import type { AutoOutcome } from '@goodboy/db';
import { delegationResultOf } from './delegationResultOf';

type Params = {
  readonly summary: string | null;
  readonly outcome: AutoOutcome;
};

export const declaredOutcomeLineOf = ({ summary, outcome }: Params): OutcomeLine | null =>
  delegationResultOf({
    result: { outcome, declared: summary === null ? {} : { summary } },
  })?.outcomeLine ?? null;
