import { describe, expect, it } from 'vitest';
import type { IsoDateTime, OrchestratorHint } from '@goodboy/types';
import {
  activeOrchestratorHints,
  consumeOrchestratorHints,
  hasHintArrivedSince,
} from './orchestratorHintQueue';

const AT = '2026-09-23T10:00:00.000Z' as IsoDateTime;
const LATER = '2026-09-23T10:05:00.000Z' as IsoDateTime;

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  isPinned: false,
  createdAt: AT,
  ...over,
});

describe('orchestratorHintQueue', () => {
  it('reads pinned hints and unread hints, never a hint already read', () => {
    const hints = [
      hint({ id: 'pinned', isPinned: true, consumedAt: AT }),
      hint({ id: 'queued' }),
      hint({ id: 'read', consumedAt: AT, consumedAtStep: 2 }),
    ];
    expect(activeOrchestratorHints({ hints }).map((entry) => entry.id)).toEqual([
      'pinned',
      'queued',
    ]);
  });

  it('spots a hint written after the decision started', () => {
    const hints = [hint({ id: 'seen' }), hint({ id: 'new' })];
    expect(hasHintArrivedSince({ hints, seenIds: new Set(['seen']) })).toBe(true);
    expect(hasHintArrivedSince({ hints, seenIds: new Set(['seen', 'new']) })).toBe(false);
  });

  it('ignores a removed or already read hint when looking for new ones', () => {
    const hints = [hint({ id: 'read', consumedAt: AT })];
    expect(hasHintArrivedSince({ hints, seenIds: new Set() })).toBe(false);
  });

  it('marks the unpinned hints a decision read, and keeps pinned ones standing', () => {
    const hints = [
      hint({ id: 'queued' }),
      hint({ id: 'pinned', isPinned: true }),
      hint({ id: 'late' }),
    ];
    const next = consumeOrchestratorHints({
      hints,
      readIds: new Set(['queued', 'pinned']),
      consumedAt: LATER,
      step: 3,
    });
    expect(next.find((entry) => entry.id === 'queued')).toMatchObject({
      consumedAt: LATER,
      consumedAtStep: 3,
    });
    expect(next.find((entry) => entry.id === 'pinned')?.consumedAt).toBeUndefined();
    expect(next.find((entry) => entry.id === 'late')?.consumedAt).toBeUndefined();
  });
});
