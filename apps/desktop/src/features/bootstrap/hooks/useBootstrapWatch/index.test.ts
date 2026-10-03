// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { RemoteProbe } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useBootstrapWatch } from './index';

const project = aProject({ name: 'cascadia', kind: 'repo', rootPath: '/games/cascadia' });
const PROJECT_ID = project.id;

let useAppStore: StoryStore;
let probes: ReadonlyArray<string>;
let answer: RemoteProbe;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const answerWith = (next: RemoteProbe) => {
  answer = next;
};

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(async () => {
  await resetStoryStore();
  probes = [];
  answer = { kind: 'reachable-no-main' };
  stubStoryInvoke({
    project_remote_probe: ({ projectId }: { readonly projectId: string }): RemoteProbe => {
      probes = [...probes, projectId];
      return answer;
    },
  });
  useAppStore.setState({ projects: [project] });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useBootstrapWatch', () => {
  it('checks once when it starts and then every minute', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    expect(probes).toEqual([PROJECT_ID]);
    expect(useAppStore.getState().bootstrapRemoteProbe[PROJECT_ID]?.probe).toEqual(answer);

    await tick(60_000);
    expect(probes).toHaveLength(2);
    await tick(60_000);
    expect(probes).toHaveLength(3);
  });

  it('does nothing while it is switched off or has no project', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: false }));
    renderHook(() => useBootstrapWatch({ projectId: null, enabled: true }));
    await tick(120_000);

    expect(probes).toEqual([]);
  });

  it('checks again shortly after the window gets focus, once for a burst', async () => {
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    probes = [];

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    await tick(400);

    expect(probes).toHaveLength(1);
  });

  it('backs off to five minutes after three unreachable answers in a row', async () => {
    answerWith({ kind: 'unreachable', reason: 'offline' });
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    await tick(60_000);
    await tick(60_000);
    expect(probes).toHaveLength(3);

    await tick(60_000);
    expect(probes).toHaveLength(3);
    await tick(240_000);
    expect(probes).toHaveLength(4);
  });

  it('keeps asking every minute while there is no remote yet', async () => {
    answerWith({ kind: 'no-remote' });
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);

    await tick(60_000);
    expect(probes).toHaveLength(2);
    await tick(60_000);
    expect(probes).toHaveLength(3);
  });

  it('stops once main is on the remote', async () => {
    answerWith({ kind: 'main-present', branch: 'main', sha: 'abc' });
    renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    expect(probes).toHaveLength(1);

    await tick(300_000);

    expect(probes).toHaveLength(1);
  });

  it('stops checking when it unmounts', async () => {
    const view = renderHook(() => useBootstrapWatch({ projectId: PROJECT_ID, enabled: true }));
    await tick(0);
    probes = [];

    view.unmount();
    await tick(600_000);

    expect(probes).toEqual([]);
  });
});
