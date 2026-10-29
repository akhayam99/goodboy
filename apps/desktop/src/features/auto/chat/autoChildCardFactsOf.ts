import type { Tone } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import type { TailFacts } from '../../live-state/tailFacts';
import { AUTO_STATE_TONE } from './autoStateTone';
import type { DelegationCardModel } from './delegationCardOf';

export type AutoChildCardFacts = Readonly<{
  word: string;
  tone: Tone;
  startedAt: IsoDateTime | null;
  activity: string | null;
  canStop: boolean;
}>;

type Params = {
  readonly card: DelegationCardModel;
  readonly live: TailFacts | null;
};

type ToneParams = {
  readonly card: DelegationCardModel;
};

const cardToneOf = ({ card }: ToneParams): Tone => {
  if (card.status.tone === 'warning') {
    return AUTO_STATE_TONE.waitingOnYou;
  }
  return card.status.isLive ? AUTO_STATE_TONE.running : AUTO_STATE_TONE.idle;
};

export const autoChildCardFactsOf = ({ card, live }: Params): AutoChildCardFacts => {
  const isRunning = card.status.word === 'Running';
  const isAsking = card.status.tone === 'warning';
  const hasActivity = live !== null && (isRunning || isAsking);
  return {
    word: card.status.word,
    tone: cardToneOf({ card }),
    startedAt: live?.startedAt ?? null,
    activity: hasActivity ? live.phrase : null,
    canStop:
      card.status.word !== 'Stopping' &&
      (live?.actions.some((one) => one.id === 'stopAgent') ?? false),
  };
};
