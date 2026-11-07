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

const AUTO_FAILED: Glance = {
  state: 'failed',
  word: 'Failed',
  tone: 'danger',
  sentence: "Auto couldn't reply",
  isLive: false,
};

const AUTO_PAUSED: Glance = {
  state: 'paused',
  word: 'Paused',
  tone: 'warning',
  sentence: 'At the limit',
  isLive: false,
};

describe('overviewGlanceOf', () => {
  it('says nothing needs you when nothing waits, runs, is stuck or is next', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 0,
        failedCount: 0,
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
        failedCount: 0,
        autoGlances: [],
        nextTitle: null,
      }),
    ).toEqual({
      state: 'waiting',
      tone: 'warning',
      sentence: '2 need you, 1 running',
    });
  });

  it('turns red for a failed Auto and names it', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 1,
        failedCount: 0,
        autoGlances: [AUTO_FAILED],
        nextTitle: null,
      }),
    ).toEqual({ state: 'stuck', tone: 'danger', sentence: 'Auto failed' });
  });

  it('stays amber for an Auto paused at its limit and names it', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 0 }),
        stuckCount: 0,
        failedCount: 0,
        autoGlances: [AUTO_PAUSED],
        nextTitle: null,
      }),
    ).toEqual({ state: 'stuck', tone: 'warning', sentence: 'Auto paused' });
  });

  it('counts stopped work as stopped and says one that needs you in the singular', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 1, running: 0 }),
        stuckCount: 2,
        failedCount: 0,
        autoGlances: [],
        nextTitle: null,
      }).sentence,
    ).toBe('1 needs you, 2 stopped');
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 1 }),
        stuckCount: 2,
        failedCount: 0,
        autoGlances: [],
        nextTitle: null,
      }).sentence,
    ).toBe('2 stopped, 1 running');
  });

  it('is blue when only agents work', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 3 }),
        stuckCount: 0,
        failedCount: 0,
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
        failedCount: 0,
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
        failedCount: 0,
        autoGlances: [],
        nextTitle: 'Rebase ledger-core on main',
      }).state,
    ).toBe('waiting');
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 0, running: 2 }),
        stuckCount: 0,
        failedCount: 0,
        autoGlances: [],
        nextTitle: 'Rebase ledger-core on main',
      }).state,
    ).toBe('working');
  });

  it('reads a carded failed Auto once as failed, never as needing you', () => {
    expect(
      overviewGlanceOf({
        cards: cardsOf({ needs: 1, running: 0 }),
        stuckCount: 0,
        failedCount: 1,
        autoGlances: [],
        nextTitle: null,
      }),
    ).toEqual({ state: 'stuck', tone: 'danger', sentence: 'Auto failed' });
  });
});
