import type { AnsweredAsk } from '../../../features/permissions/askBatchOf';

type Params = {
  readonly held: ReadonlyArray<AnsweredAsk>;
};

export const heldReasonsOf = ({ held }: Params): ReadonlyArray<string> =>
  held
    .filter((ask) => ask.decision === 'deny')
    .map((ask) => (ask.reason ?? '').trim())
    .filter((reason) => reason !== '');
