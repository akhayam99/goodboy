import type { Tone } from '@goodboy/ui';
import { AUTO_STATE_TONE } from './autoStateTone';
import type { DelegationCardModel } from './delegationCardOf';

export type AutoChildCardFacts = Readonly<{
  word: string;
  tone: Tone;
}>;

type Params = {
  readonly card: DelegationCardModel;
};

const cardToneOf = ({ card }: Params): Tone => {
  if (card.status.tone === 'danger') {
    return 'danger';
  }
  if (card.status.tone === 'warning') {
    return AUTO_STATE_TONE.waitingOnYou;
  }
  return card.status.isLive ? AUTO_STATE_TONE.running : AUTO_STATE_TONE.idle;
};

export const autoChildCardFactsOf = ({ card }: Params): AutoChildCardFacts => ({
  word: card.status.word,
  tone: cardToneOf({ card }),
});
