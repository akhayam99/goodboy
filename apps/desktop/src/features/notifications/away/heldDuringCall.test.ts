import { beforeEach, describe, expect, it } from 'vitest';
import { brandId, type SessionAttentionReason, type SessionId } from '@goodboy/types';
import type { AwayBanner } from './awayBannersOf';
import { useCallQuietStore } from './callQuietStore';
import { heldDuringCall } from './heldDuringCall';

const NOW = Date.UTC(2026, 10, 27, 10, 40);
const QUIET = { eventId: 'northwind-sync', until: NOW + 20 * 60_000 };

type BannerParams = {
  readonly reason: SessionAttentionReason | null;
};

const bannerOf = ({ reason }: BannerParams): AwayBanner => ({
  sessionId: brandId<SessionId>({ value: `session-${reason ?? 'group'}` }),
  reason,
  title: 'payments-api',
  body: reason ?? '3 sessions need you',
  keys: [`payments-api:${reason ?? 'group'}`],
});

const QUESTION = bannerOf({ reason: 'open-question' });
const CI = bannerOf({ reason: 'ci-failed' });
const PUSH = bannerOf({ reason: 'push-failed' });
const GROUPED = bannerOf({ reason: null });

describe('heldDuringCall', () => {
  it('shows every banner when no call is on', () => {
    expect(heldDuringCall({ banners: [QUESTION, CI], quiet: null, now: NOW })).toEqual({
      shown: [QUESTION, CI],
      held: [],
    });
  });

  it('holds every notice during a call except what blocks a release', () => {
    expect(
      heldDuringCall({ banners: [QUESTION, CI, PUSH, GROUPED], quiet: QUIET, now: NOW }),
    ).toEqual({ shown: [CI, PUSH], held: [QUESTION, GROUPED] });
  });

  it('stops holding once the call is over, even when the end was never heard', () => {
    expect(heldDuringCall({ banners: [QUESTION], quiet: QUIET, now: QUIET.until })).toEqual({
      shown: [QUESTION],
      held: [],
    });
  });
});

describe('useCallQuietStore', () => {
  beforeEach(() => {
    useCallQuietStore.setState({ quiet: null, held: [] });
  });

  it('keeps what it held during the call and releases it once, at the end', () => {
    const store = useCallQuietStore.getState();
    store.startQuiet({ quiet: QUIET });
    store.hold({ banners: [QUESTION] });
    store.hold({ banners: [GROUPED] });
    expect(useCallQuietStore.getState().endQuiet({ eventId: 'acme-review' })).toEqual([]);
    expect(useCallQuietStore.getState().endQuiet({ eventId: QUIET.eventId })).toEqual([
      QUESTION,
      GROUPED,
    ]);
    expect(useCallQuietStore.getState()).toMatchObject({ quiet: null, held: [] });
    expect(useCallQuietStore.getState().endQuiet({ eventId: QUIET.eventId })).toEqual([]);
  });

  it('keeps held notices when the next call starts straight after', () => {
    const store = useCallQuietStore.getState();
    store.startQuiet({ quiet: QUIET });
    store.hold({ banners: [QUESTION] });
    store.startQuiet({ quiet: { eventId: 'acme-review', until: QUIET.until + 60_000 } });
    expect(useCallQuietStore.getState().endQuiet({ eventId: 'acme-review' })).toEqual([QUESTION]);
  });
});
