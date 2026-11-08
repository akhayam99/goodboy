import type { Agent } from '@goodboy/types';
import { stoppedPhraseOf } from '../../live-state/stoppedPhraseOf';

type Params = {
  readonly agent: Pick<Agent, 'stoppedBy'>;
  readonly kept?: string;
};

const IT_IS_KEPT = 'What it wrote is kept.';

export const stoppedSentenceOf = ({ agent, kept = IT_IS_KEPT }: Params): string =>
  `${stoppedPhraseOf({ by: agent.stoppedBy, isLong: true })}. ${kept}`;
