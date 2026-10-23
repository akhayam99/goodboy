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

describe('overviewCardsOf', () => {
  it('orders the cards by who acts: you must, agents are, you may, branches, finished', () => {
    const shown = overviewCardsOf({
      cards: CARDS,
      runningCount: 2,
      branchCount: 3,
      doneCount: 4,
      isArchived: false,
    });

    expect(shown.map((card) => [card.title, card.count])).toEqual([
      ['Needs you', 1],
      ['Running', 2],
      ['Next', 1],
      ['Branches', 3],
      ['Done', 4],
    ]);
  });

  it('draws no empty card', () => {
    const shown = overviewCardsOf({
      cards: actionCardsOf({ owners: [], suggestions: [PUSH], autoTargets: [] }),
      runningCount: 0,
      branchCount: 1,
      doneCount: 0,
      isArchived: false,
    });

    expect(shown.map((card) => card.id)).toEqual(['next', 'branches']);
    expect(
      overviewCardsOf({
        cards: [],
        runningCount: 0,
        branchCount: 0,
        doneCount: 0,
        isArchived: false,
      }),
    ).toEqual([]);
  });

  it('keeps only Done on an archived session', () => {
    const shown = overviewCardsOf({
      cards: CARDS,
      runningCount: 2,
      branchCount: 3,
      doneCount: 4,
      isArchived: true,
    });

    expect(shown.map((card) => card.id)).toEqual(['done']);
  });
});
