import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Pick<Agent, 'stoppedBy'>;
  readonly kept?: string;
};

const IT_IS_KEPT = 'What it wrote is kept.';

export const stoppedSentenceOf = ({ agent, kept = IT_IS_KEPT }: Params): string =>
  agent.stoppedBy === 'app'
    ? `Stopped by a restart of the app. ${kept}`
    : `Stopped by you. ${kept}`;
