import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextProviderRunId } from '@goodboy/types/testing';
import { liveTextRegistry } from './liveTextRegistry';

const RUN = nextProviderRunId();
const OTHER_RUN = nextProviderRunId();

describe('liveTextRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    liveTextRegistry.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('knows nothing about a run that never streamed in this window', () => {
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(false);
  });

  it('marks a run live right after a delta', () => {
    liveTextRegistry.mark({ runId: RUN });
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(true);
    expect(liveTextRegistry.isLive({ runId: OTHER_RUN })).toBe(false);
  });

  it('shows whole text for a host that mounts more than 1.5 s after the last delta', () => {
    liveTextRegistry.mark({ runId: RUN });
    vi.advanceTimersByTime(1400);
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(true);
    vi.advanceTimersByTime(200);
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(false);
  });

  it('a later delta makes the run live again', () => {
    liveTextRegistry.mark({ runId: RUN });
    vi.advanceTimersByTime(5000);
    liveTextRegistry.mark({ runId: RUN });
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(true);
  });

  it('forgets old runs so the map stays bounded', () => {
    liveTextRegistry.mark({ runId: RUN });
    vi.advanceTimersByTime(60_000);
    liveTextRegistry.mark({ runId: OTHER_RUN });
    expect(liveTextRegistry.isLive({ runId: RUN })).toBe(false);
  });
});
