// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Glance } from '../glance/glanceOf';
import { overviewGlanceOf } from './overviewGlanceOf';
import type { OverviewCardModel } from './overviewCardsOf';

type CardsParams = {
  readonly needs: number;
  readonly running: number;
};

const cardsOf = ({ needs, running }: CardsParams): ReadonlyArray<OverviewCardModel> => [
  { id: 'needs-you', title: 'Needs you', count: needs },
  ...(running > 0 ? [{ id: 'running' as const, title: 'Running', count: running }] : []),
];

const AUTO_STUCK: Glance = {
  state: 'stuck',
  word: 'Stuck',
  tone: 'danger',
  sentence: 'Auto is blocked',
  isLive: false,
};

describe('overviewGlanceOf', () => {
  it('says nothing needs you when nothing waits, runs, is stuck or is next', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: null,
      }),
    ).toEqual({
      state: 'clear',
      tone: 'success',
      sentence: 'Nothing needs you',
    });
  });

  it('reads the card counts for what waits and what works', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 2, running: 1 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: null,
      }),
    ).toEqual({
      state: 'waiting',
      tone: 'warning',
      sentence: '2 waiting for you, 1 working',
    });
  });

  it('turns red for stuck Auto and names it', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 1,
        autoGlances: [AUTO_STUCK],
        nextTitle: null,
      }),
    ).toEqual({ state: 'stuck', tone: 'danger', sentence: 'Auto stuck' });
  });

  it('is blue when only agents work', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 3 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: null,
      }).state,
    ).toBe('working');
  });

  it('names the next step when only Next rows wait, never Nothing needs you above a filled row', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: 'Rebase ledger-core on main',
      }),
    ).toEqual({
      state: 'next',
      tone: 'info',
      sentence: 'Next: Rebase ledger-core on main',
    });
  });

  it('lets what waits for you and what works come before the next step', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 1, running: 0 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: 'Rebase ledger-core on main',
      }).state,
    ).toBe('waiting');
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 2 }),
        stuckCount: 0,
        autoGlances: [],
        nextTitle: 'Rebase ledger-core on main',
      }).state,
    ).toBe('working');
  });
});
