// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ProjectId, RemoteProbe } from '@goodboy/types';

const PROJECT_ID = 'proj-cascadia' as ProjectId;

const h = vi.hoisted(() => ({
  probe: vi.fn(),
  store: {
    probeProjectRemote: vi.fn(),
    bootstrapRemoteProbe: {} as Record<string, { probe: RemoteProbe }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { useBootstrapWatch } from './index';

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  h.probe.mockReset();
  h.probe.mockResolvedValue({ kind: 'reachable-no-main' } satisfies RemoteProbe);
  h.store.probeProjectRemote = h.probe;
  h.store.bootstrapRemoteProbe = {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useBootstrapWatch', () => {
  it('checks once when it starts and then every minute', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    expect(h.probe).toHaveBeenCalledTimes(1);
    expect(h.probe).toHaveBeenCalledWith({ projectId: PROJECT_ID });

    await tick(60_000);
    expect(h.probe).toHaveBeenCalledTimes(2);
    await tick(60_000);
    expect(h.probe).toHaveBeenCalledTimes(3);
  });

  it('does nothing while it is switched off or has no project', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: false }));
    renderHook(() => useBootstrapWatch({ projectId: null, enabled: true }));
    await tick(120_000);

    expect(h.probe).not.toHaveBeenCalled();
  });

  it('checks again shortly after the window gets focus, once for a burst', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    h.probe.mockClear();

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    await tick(400);

    expect(h.probe).toHaveBeenCalledTimes(1);
  });

  it('backs off to five minutes after three unreachable answers in a row', async () => {
    h.probe.mockResolvedValue({ kind: 'unreachable', reason: 'offline' } satisfies RemoteProbe);
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    await tick(60_000);
    await tick(60_000);
    expect(h.probe).toHaveBeenCalledTimes(3);

    await tick(60_000);
    expect(h.probe).toHaveBeenCalledTimes(3);
    await tick(240_000);
    expect(h.probe).toHaveBeenCalledTimes(4);
  });

  it('polls slowly while there is no remote to ask', async () => {
    h.probe.mockResolvedValue({ kind: 'no-remote' } satisfies RemoteProbe);
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);

    await tick(120_000);
    expect(h.probe).toHaveBeenCalledTimes(1);
    await tick(180_000);
    expect(h.probe).toHaveBeenCalledTimes(2);
  });

  it('stops once main is on the remote', async () => {
    h.store.bootstrapRemoteProbe = {
      [PROJECT_ID]: { probe: { kind: 'main-present', branch: 'main', sha: 'abc' } },
    };
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(300_000);

    expect(h.probe).not.toHaveBeenCalled();
  });

  it('stops checking when it unmounts', async () => {
    const view = renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    h.probe.mockClear();

    view.unmount();
    await tick(600_000);

    expect(h.probe).not.toHaveBeenCalled();
  });
});
