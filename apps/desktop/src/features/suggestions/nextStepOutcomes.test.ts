import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { NudgeEvent } from '@goodboy/db';
import {
  dismissedFingerprintsFromEvents,
  nextStepNudgeKind,
  suggestionKindFromNudgeKind,
  toNextStepOutcomes,
} from './nextStepOutcomes';

const sessionId = 'session-1' as SessionId;
const AT = '2026-01-01T00:00:00.000Z' as IsoDateTime;

const nudgeEvent = (overrides: Partial<NudgeEvent> = {}): NudgeEvent => ({
  id: 'ev-1',
  sessionId,
  ts: AT,
  kind: 'next:push-branch',
  contextJson: null,
  outcome: 'dismissed',
  outcomeTs: AT,
  ...overrides,
});

describe('nextStepNudgeKind', () => {
  it('prefixes the suggestion kind', () => {
    expect(nextStepNudgeKind({ kind: 'merge-pr' })).toBe('next:merge-pr');
  });
});

describe('suggestionKindFromNudgeKind', () => {
  it('strips the prefix for a known suggestion kind', () => {
    expect(suggestionKindFromNudgeKind({ kind: 'next:merge-pr' })).toBe('merge-pr');
  });

  it('returns null for a kind without the prefix', () => {
    expect(suggestionKindFromNudgeKind({ kind: 'scope-mismatch' })).toBeNull();
  });

  it('returns null for a prefixed kind that is not a known suggestion', () => {
    expect(suggestionKindFromNudgeKind({ kind: 'next:not-a-real-kind' })).toBeNull();
  });
});

describe('toNextStepOutcomes', () => {
  it('keeps only settled next-step events, using the outcome timestamp', () => {
    const outcomes = toNextStepOutcomes({
      events: [
        nudgeEvent({ kind: 'next:push-branch', outcome: 'dismissed', outcomeTs: AT }),
        nudgeEvent({ kind: 'scope-mismatch', outcome: 'accepted' }),
        nudgeEvent({ kind: 'next:merge-pr', outcome: null, outcomeTs: null }),
      ],
    });
    expect(outcomes).toEqual([{ kind: 'push-branch', outcome: 'dismissed', at: AT }]);
  });

  it('falls back to the created timestamp when no outcome timestamp was recorded', () => {
    const outcomes = toNextStepOutcomes({
      events: [nudgeEvent({ outcome: 'accepted', outcomeTs: null })],
    });
    expect(outcomes).toEqual([{ kind: 'push-branch', outcome: 'accepted', at: AT }]);
  });
});

describe('dismissedFingerprintsFromEvents', () => {
  const withFingerprint = (fingerprint: string, overrides: Partial<NudgeEvent> = {}): NudgeEvent =>
    nudgeEvent({ contextJson: JSON.stringify({ fingerprint }), ...overrides });

  it('collects a fingerprint from a dismissed event', () => {
    const dismissed = dismissedFingerprintsFromEvents({
      events: [withFingerprint('push-branch:mount-web:4')],
    });
    expect(dismissed.has('push-branch:mount-web:4')).toBe(true);
  });

  it('ignores an event with no contextJson or unparseable contextJson', () => {
    expect(
      dismissedFingerprintsFromEvents({ events: [nudgeEvent({ contextJson: null })] }).size,
    ).toBe(0);
    expect(
      dismissedFingerprintsFromEvents({ events: [nudgeEvent({ contextJson: 'not json' })] }).size,
    ).toBe(0);
  });

  it('drops a fingerprint once a later event accepts or overrides it', () => {
    const dismissedThenAccepted = dismissedFingerprintsFromEvents({
      events: [
        withFingerprint('push-branch:mount-web:4', {
          outcome: 'dismissed',
          outcomeTs: AT,
        }),
        withFingerprint('push-branch:mount-web:4', {
          outcome: 'accepted',
          outcomeTs: '2026-01-02T00:00:00.000Z' as IsoDateTime,
        }),
      ],
    });
    expect(dismissedThenAccepted.has('push-branch:mount-web:4')).toBe(false);
  });

  it('keeps a fingerprint dismissed regardless of event order in the input', () => {
    const dismissed = dismissedFingerprintsFromEvents({
      events: [
        withFingerprint('push-branch:mount-web:4', {
          outcome: 'accepted',
          outcomeTs: AT,
        }),
        withFingerprint('push-branch:mount-web:4', {
          outcome: 'dismissed',
          outcomeTs: '2026-01-02T00:00:00.000Z' as IsoDateTime,
        }),
      ],
    });
    expect(dismissed.has('push-branch:mount-web:4')).toBe(true);
  });
});
