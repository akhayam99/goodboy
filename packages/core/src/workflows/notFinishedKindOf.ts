import type { Agent } from '@goodboy/types';

export const DID_NOT_START_PREFIX = 'Did not start: ';

export type NotFinishedKind = 'stuck' | 'dependent';

type Params = {
  readonly agent: Pick<Agent, 'status' | 'outputSummary'>;
};

export const notFinishedKindOf = ({ agent }: Params): NotFinishedKind | null => {
  const summary = (agent.outputSummary ?? '').trim();
  if (agent.status !== 'skipped' || summary.length === 0) {
    return null;
  }
  return summary.startsWith(DID_NOT_START_PREFIX) ? 'dependent' : 'stuck';
};
