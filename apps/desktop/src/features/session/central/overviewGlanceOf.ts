import type { Tone } from '@goodboy/ui';
import type { AutoGlance } from '../../auto/glance/autoGlanceOf';
import type { OverviewCardModel } from './overviewCardsOf';

export type OverviewGlanceState = 'waiting' | 'stuck' | 'working' | 'clear';

export type OverviewGlance = Readonly<{
  state: OverviewGlanceState;
  tone: Tone;
  sentence: string;
}>;

type Params = {
  readonly cards: ReadonlyArray<OverviewCardModel>;
  readonly stuckCount: number;
  readonly autoGlances: ReadonlyArray<AutoGlance>;
};

type CountParams = {
  readonly cards: ReadonlyArray<OverviewCardModel>;
  readonly id: OverviewCardModel['id'];
};

const cardCountOf = ({ cards, id }: CountParams): number =>
  cards.find((card) => card.id === id)?.count ?? 0;

export const overviewGlanceOf = ({ cards, stuckCount, autoGlances }: Params): OverviewGlance => {
  const needs = cardCountOf({ cards, id: 'needs-you' });
  const running = cardCountOf({ cards, id: 'running' });
  const autoWaiting = autoGlances.find((glance) => glance.state === 'waiting') ?? null;
  const autoStuck = autoGlances.find((glance) => glance.state === 'stuck') ?? null;
  const parts = [
    ...(needs > 0 ? [`${needs} waiting for you`] : []),
    ...(autoWaiting === null ? [] : [`Auto ${autoWaiting.word.toLowerCase()}`]),
    ...(autoStuck === null ? [] : [`Auto ${autoStuck.word.toLowerCase()}`]),
    ...(stuckCount > 0 && autoStuck === null ? [`${stuckCount} stuck`] : []),
    ...(running > 0 ? [`${running} working`] : []),
  ];
  if (needs > 0 || autoWaiting !== null) {
    return { state: 'waiting', tone: 'warning', sentence: parts.join(', ') };
  }
  if (stuckCount > 0 || autoStuck !== null) {
    return { state: 'stuck', tone: 'danger', sentence: parts.join(', ') };
  }
  if (running > 0) {
    return { state: 'working', tone: 'info', sentence: parts.join(', ') };
  }
  return { state: 'clear', tone: 'success', sentence: 'Nothing needs you' };
};
