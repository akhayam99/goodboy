import { describe, expect, it } from 'vitest';
import { AUTO_LEAD_FRESH_GAP_MS } from './limits';
import { leadDeliveryModeOf, type LeadDeliveryModeParams } from './leadDeliveryModeOf';

const NOW = 10 * AUTO_LEAD_FRESH_GAP_MS;

const params = (overrides: Partial<LeadDeliveryModeParams> = {}): LeadDeliveryModeParams => ({
  resumeSessionId: 'session-ledger-core',
  baselineSessionId: 'session-ledger-core',
  lastTurn: { endedAtMs: NOW - 60_000, model: 'sonnet' },
  model: 'sonnet',
  nowMs: NOW,
  ...overrides,
});

describe('what a Lead delivery carries', () => {
  it('sends everything on the first turn of a session', () => {
    expect(leadDeliveryModeOf(params({ resumeSessionId: null, lastTurn: null }))).toBe('full');
  });

  it('sends only what changed to a session that acknowledged the last delivery', () => {
    expect(leadDeliveryModeOf(params())).toBe('delta');
  });

  it('sends everything when nothing was acknowledged in this session', () => {
    expect(leadDeliveryModeOf(params({ baselineSessionId: null }))).toBe('full');
    expect(leadDeliveryModeOf(params({ baselineSessionId: 'session-notify-relay' }))).toBe('full');
  });

  it('starts a new session once the gap passes 55 minutes, and resumes up to it', () => {
    const atEdge = { endedAtMs: NOW - AUTO_LEAD_FRESH_GAP_MS, model: 'sonnet' };
    const past = { endedAtMs: NOW - AUTO_LEAD_FRESH_GAP_MS - 1, model: 'sonnet' };

    expect(leadDeliveryModeOf(params({ lastTurn: atEdge }))).toBe('delta');
    expect(leadDeliveryModeOf(params({ lastTurn: past }))).toBe('fresh');
  });

  it('starts a new session when the model changed, and not when the old one is unknown', () => {
    expect(leadDeliveryModeOf(params({ model: 'opus' }))).toBe('fresh');
    expect(
      leadDeliveryModeOf(params({ model: 'opus', lastTurn: { endedAtMs: NOW, model: null } })),
    ).toBe('delta');
  });
});
