import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { SessionSuggestion } from './types';
import {
  applyDismissals,
  dedupeByTargetKey,
  isFresh,
  shouldDemote,
  sortNextSteps,
} from './nextStepGates';

const SESSION_ID = 'session-1' as SessionId;

const suggestion = (overrides: Partial<SessionSuggestion> = {}): SessionSuggestion =>
  ({
    id: 'answer-questions:session-1',
    kind: 'answer-questions',
    priority: 0,
    band: 0,
    title: 'Answer open questions',
    sessionId: SESSION_ID,
    targetKey: null,
    fingerprint: 'answer-questions:session-1:1',
    payload: { count: 1 },
    ...overrides,
  }) as SessionSuggestion;

describe('isFresh', () => {
  it('treats unknown freshness (no fetchedAt) as fresh', () => {
    expect(isFresh({ fetchedAt: null, now: () => Date.now() })).toBe(true);
  });

  it('is fresh within the 5 minute default window', () => {
    const now = Date.parse('2026-06-08T10:04:00.000Z');
    expect(isFresh({ fetchedAt: '2026-06-08T10:00:00.000Z', now: () => now })).toBe(true);
  });

  it('is stale past the default window', () => {
    const now = Date.parse('2026-06-08T10:06:00.000Z');
    expect(isFresh({ fetchedAt: '2026-06-08T10:00:00.000Z', now: () => now })).toBe(false);
  });
});

describe('dedupeByTargetKey', () => {
  it('keeps every suggestion when none share a target', () => {
    const suggestions = [
      suggestion({ id: 'a', targetKey: null }),
      suggestion({ id: 'b', targetKey: 'mount:1' }),
    ];
    expect(dedupeByTargetKey({ suggestions })).toHaveLength(2);
  });

  it('keeps only the highest-priority band for a shared target', () => {
    const suggestions = [
      suggestion({ id: 'fix-ci', targetKey: 'pr:1', band: 1 }),
      suggestion({ id: 'merge', targetKey: 'pr:1', band: 2 }),
    ];
    const kept = dedupeByTargetKey({ suggestions });
    expect(kept).toHaveLength(1);
    expect(kept[0]?.id).toBe('fix-ci');
  });
});

describe('applyDismissals', () => {
  it('passes suggestions through unchanged when nothing was dismissed', () => {
    const suggestions = [suggestion()];
    expect(applyDismissals({ suggestions })).toBe(suggestions);
  });

  it('removes a suggestion whose fingerprint was dismissed', () => {
    const suggestions = [
      suggestion({ fingerprint: 'a' }),
      suggestion({ id: 'b', fingerprint: 'b' }),
    ];
    const kept = applyDismissals({
      suggestions,
      dismissedFingerprints: new Set(['a']),
    });
    expect(kept.map((s) => s.fingerprint)).toEqual(['b']);
  });

  it('lets a suggestion return once its fingerprint changes (new trigger version)', () => {
    const suggestions = [suggestion({ fingerprint: 'answer-questions:session-1:2' })];
    const kept = applyDismissals({
      suggestions,
      dismissedFingerprints: new Set(['answer-questions:session-1:1']),
    });
    expect(kept).toHaveLength(1);
  });
});

describe('sortNextSteps', () => {
  it('orders by band-derived priority, then id', () => {
    const suggestions = [
      suggestion({ id: 'z', priority: 5 }),
      suggestion({ id: 'a', priority: 5 }),
      suggestion({ id: 'first', priority: 0 }),
    ];
    expect(sortNextSteps({ suggestions }).map((s) => s.id)).toEqual(['first', 'a', 'z']);
  });

  it('pushes a demoted kind to the back without removing it', () => {
    const suggestions = [
      suggestion({ id: 'rebase', kind: 'rebase-project', priority: 40 }),
      suggestion({ id: 'plan', kind: 'plan-ready', priority: 20 }),
    ];
    const sorted = sortNextSteps({
      suggestions,
      demotedKinds: new Set(['plan-ready']),
    });
    expect(sorted.map((s) => s.id)).toEqual(['rebase', 'plan']);
  });
});

describe('shouldDemote', () => {
  const now = () => Date.parse('2026-06-08T10:00:00.000Z');

  it('is false with fewer than the dismissal threshold', () => {
    const outcomes = [
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-01T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-02T00:00:00.000Z',
      },
    ];
    expect(shouldDemote({ kind: 'plan-ready', outcomes, now })).toBe(false);
  });

  it('is true at three dismissals within the window with no acceptance', () => {
    const outcomes = [
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-01T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-02T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-03T00:00:00.000Z',
      },
    ];
    expect(shouldDemote({ kind: 'plan-ready', outcomes, now })).toBe(true);
  });

  it('resets once any acceptance lands in the window', () => {
    const outcomes = [
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-01T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-02T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-03T00:00:00.000Z',
      },
      { kind: 'plan-ready' as const, outcome: 'accepted' as const, at: '2026-06-04T00:00:00.000Z' },
    ];
    expect(shouldDemote({ kind: 'plan-ready', outcomes, now })).toBe(false);
  });

  it('ignores dismissals outside the 14 day window', () => {
    const outcomes = [
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-05-01T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-05-02T00:00:00.000Z',
      },
      {
        kind: 'plan-ready' as const,
        outcome: 'dismissed' as const,
        at: '2026-05-03T00:00:00.000Z',
      },
    ];
    expect(shouldDemote({ kind: 'plan-ready', outcomes, now })).toBe(false);
  });

  it('ignores outcomes for a different kind', () => {
    const outcomes = [
      {
        kind: 'rebase-project' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-01T00:00:00.000Z',
      },
      {
        kind: 'rebase-project' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-02T00:00:00.000Z',
      },
      {
        kind: 'rebase-project' as const,
        outcome: 'dismissed' as const,
        at: '2026-06-03T00:00:00.000Z',
      },
    ];
    expect(shouldDemote({ kind: 'plan-ready', outcomes, now })).toBe(false);
  });
});
