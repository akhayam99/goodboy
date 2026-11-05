import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import type { SessionSuggestion } from '../../suggestions/types';
import { actionCardsOf } from './next/actionCardsOf';
import { aQuestionCard } from './now/testing/nowCards';
import { overviewCardsOf } from './overviewCardsOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const FAQ = brandId<MountId>({ value: 'mount-faq' });

const PUSH: SessionSuggestion = {
  id: 'push-branch:faq',
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title: 'Push hl/feat-center-faq-page',
  sessionId: SESSION_ID,
  fingerprint: 'push-branch:faq',
  targetKey: `branch:${FAQ}`,
  payload: {
    mountId: FAQ,
    projectId: brandId({ value: 'project-harbor' }),
    projectName: 'harbor-portal',
    branch: 'hl/feat-center-faq-page',
    worktreePath: '/work/faq',
    state: 'not-pushed',
    ahead: 4,
    behind: 0,
  },
};

const CARDS = [
  aQuestionCard({ where: null }),
  ...actionCardsOf({ owners: [], suggestions: [PUSH], autoTargets: [] }),
];

const NONE = {
  cards: [],
  waitingCount: 0,
  runningCount: 0,
  stuckCount: 0,
  branchCount: 0,
  doneCount: 0,
  isArchived: false,
} as const;

describe('overviewCardsOf', () => {
  it('orders the cards by the reader question: do, next, moving, finished', () => {
    const shown = overviewCardsOf({
      ...NONE,
      cards: CARDS,
      runningCount: 2,
      branchCount: 3,
      doneCount: 4,
    });

    expect(shown.map((card) => [card.title, card.count])).toEqual([
      ['Needs you', 1],
      ['Branches', 3],
      ['Running', 2],
      ['Done', 4],
    ]);
  });

  it('counts waiting live work and open questions in one Needs you card', () => {
    const shown = overviewCardsOf({ ...NONE, cards: CARDS, waitingCount: 2 });

    expect(shown.filter((card) => card.id === 'needs-you').map((card) => card.count)).toEqual([3]);
  });

  it('keeps the running card for stopped work and counts only what runs', () => {
    const shown = overviewCardsOf({ ...NONE, stuckCount: 1 });

    expect(shown.map((card) => [card.id, card.count])).toEqual([
      ['needs-you', 0],
      ['running', 0],
    ]);
  });

  it('keeps Needs you at zero so the page can say nothing needs you', () => {
    expect(overviewCardsOf(NONE).map((card) => [card.id, card.count])).toEqual([['needs-you', 0]]);
  });

  it('draws a Branches card for several branches or for a next step, not for one branch', () => {
    const next = actionCardsOf({ owners: [], suggestions: [PUSH], autoTargets: [] });

    expect(overviewCardsOf({ ...NONE, branchCount: 1 }).map((card) => card.id)).toEqual([
      'needs-you',
    ]);
    expect(overviewCardsOf({ ...NONE, branchCount: 2 }).map((card) => card.id)).toEqual([
      'needs-you',
      'branches',
    ]);
    expect(
      overviewCardsOf({ ...NONE, cards: next, branchCount: 1 }).map((card) => card.id),
    ).toEqual(['needs-you', 'branches']);
  });

  it('keeps only Done on an archived session', () => {
    const shown = overviewCardsOf({
      ...NONE,
      cards: CARDS,
      runningCount: 2,
      branchCount: 3,
      doneCount: 4,
      isArchived: true,
    });

    expect(shown.map((card) => card.id)).toEqual(['done']);
  });
});
