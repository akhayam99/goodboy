// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId } from '@goodboy/types';
import type { SessionSuggestion } from '../../../suggestions/types';
import { aQuestionCard } from '../now/testing/nowCards';
import type { ActionCardModel } from '../next/actionCardsOf';
import { cardOrderOf } from './cardOrderOf';

const mount = (value: string) => brandId<MountId>({ value });

const rebaseCard = (): ActionCardModel => {
  const suggestion: SessionSuggestion = {
    id: 'rebase-project:s1',
    kind: 'rebase-project',
    priority: 40,
    band: 2,
    title: 'Rebase 2 branches',
    detail: '2 branches behind',
    sessionId: brandId({ value: 's1' }),
    targetKey: null,
    fingerprint: 'rebase',
    payload: {
      targets: ['m2', 'm3'].map((id) => ({
        id,
        mountId: mount(id),
        projectId: brandId<ProjectId>({ value: 'p1' }),
        projectName: 'payments-api',
        branch: `ak/${id}`,
        worktreePath: `/work/${id}`,
        baseBranch: 'main',
        behind: 2,
        dirtyCount: 0,
      })),
    },
  };
  return {
    id: 'suggestion:rebase',
    band: 2,
    priority: 40,
    kind: 'rebase-project',
    title: suggestion.title,
    detail: suggestion.detail ?? null,
    mountId: null,
    source: { kind: 'suggestion', suggestion },
  };
};

describe('cardOrderOf', () => {
  it('maps a card to its mount and the first card wins', () => {
    const first = { ...aQuestionCard({ where: null }), id: 'a', mountId: 'm1' };
    const second = { ...aQuestionCard({ where: null }), id: 'b', mountId: 'm1' };
    expect(cardOrderOf({ cards: [first, second] }).get('m1')).toBe(0);
  });

  it('gives every target of a rebase card the position of that card', () => {
    const order = cardOrderOf({ cards: [aQuestionCard({ where: null }), rebaseCard()] });
    expect(order.get('m2')).toBe(1);
    expect(order.get('m3')).toBe(1);
    expect(order.has('m1')).toBe(false);
  });
});
