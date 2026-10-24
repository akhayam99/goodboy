// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { aView, FIXTURE_ROOT, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { useAutoTreeViews } from '.';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const read = () => renderHook(() => useAutoTreeViews({ sessionId: FIXTURE_SESSION }));

describe('useAutoTreeViews', () => {
  it('lists the tree while its root agent is in the session', () => {
    const view = aView({ phase: 'waiting' });
    store.setState({
      autoTreeViews: { [FIXTURE_SESSION]: [view] },
      sessionPhaseRuns: { [FIXTURE_SESSION]: [anAgent({ id: FIXTURE_ROOT, kind: 'auto' })] },
    });

    expect(read().result.current).toEqual([view]);
  });

  it('drops the tree the moment its root agent leaves the session', () => {
    const view = aView({ phase: 'waiting' });
    store.setState({
      autoTreeViews: { [FIXTURE_SESSION]: [view] },
      sessionPhaseRuns: { [FIXTURE_SESSION]: [anAgent({ id: FIXTURE_ROOT, kind: 'auto' })] },
    });
    const hook = read();
    expect(hook.result.current).toHaveLength(1);

    act(() => store.setState({ sessionPhaseRuns: { [FIXTURE_SESSION]: [] } }));

    expect(hook.result.current).toEqual([]);
  });

  it('does not hide a tree before the agents of the session were read', () => {
    const view = aView({ phase: 'waiting' });
    store.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] }, sessionPhaseRuns: {} });

    expect(read().result.current).toEqual([view]);
  });
});
