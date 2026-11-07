import type { Tone } from '@goodboy/ui';
import { LIVE_TONE } from '../now/liveTone';
import type { ActionCardModel } from './actionCardsOf';

type Params = {
  readonly card: ActionCardModel;
};

export type CardStateWord = Readonly<{
  tone: Tone;
  word: string;
}>;

export const cardStateWordOf = ({ card }: Params): CardStateWord | null =>
  card.source.kind === 'auto' && card.source.target.kind === 'blocked'
    ? LIVE_TONE.state.failed
    : null;
