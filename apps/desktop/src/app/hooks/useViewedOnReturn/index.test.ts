// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { nextAgentId, nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { useViewedOnReturn } from './index';

const SESSION_ID = nextSessionId();
const AGENT_ID = nextAgentId();

let useAppStore: StoryStore;
const markAgentSeen = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  markAgentSeen.mockClear();
  useAppStore.setState({
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    markAgentSeen,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useViewedOnReturn', () => {
  it('stamps the open agent when the window gets focus back', () => {
    renderHook(() => useViewedOnReturn());
    window.dispatchEvent(new Event('focus'));
    expect(markAgentSeen).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
  });

  it('stamps the open agent when a hidden window shows again', () => {
    renderHook(() => useViewedOnReturn());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(markAgentSeen).not.toHaveBeenCalled();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(markAgentSeen).toHaveBeenCalledWith(SESSION_ID, AGENT_ID);
  });

  it('stamps nothing while the window is still behind another one', () => {
    renderHook(() => useViewedOnReturn());
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(markAgentSeen).not.toHaveBeenCalled();
  });

  it('stamps nothing when no agent is open', () => {
    useAppStore.setState({ selectedAgentId: {} });
    renderHook(() => useViewedOnReturn());
    window.dispatchEvent(new Event('focus'));
    expect(markAgentSeen).not.toHaveBeenCalled();
  });

  it('stops listening once the window is gone', () => {
    const { unmount } = renderHook(() => useViewedOnReturn());
    unmount();
    window.dispatchEvent(new Event('focus'));
    expect(markAgentSeen).not.toHaveBeenCalled();
  });
});
