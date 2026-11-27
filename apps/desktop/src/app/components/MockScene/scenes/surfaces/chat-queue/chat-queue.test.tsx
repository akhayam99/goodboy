// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { installBackends } from '../../../../../installBackends';
import { mockRuntime } from '../../../installMockRuntime';
import { MOCK_SCENES } from '../../..';
import { CHAT_QUEUE_SCENES } from './chat-queue';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  installBackends(mockRuntime());
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the Chat queue scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(CHAT_QUEUE_SCENES)).toEqual(['chat-queue']);
    expect(MOCK_SCENES['chat-queue']).toBe(CHAT_QUEUE_SCENES['chat-queue']);
  });

  it('shows two queued messages above the box while the answer runs, and removes one', async () => {
    const Scene = CHAT_QUEUE_SCENES['chat-queue'];
    render(<Scene />);

    const list = await screen.findByRole('list', { name: 'Queued messages' }, WAIT);
    const items = within(list).getAllByTestId('queued-message-row');
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['queued', 'queued']);
    screen.getByRole('button', { name: 'Stop' });

    const [first] = items;
    if (first === undefined) {
      throw new Error('the tray has no row');
    }
    fireEvent.click(within(first).getByRole('button', { name: 'Remove from queue' }));

    expect(within(list).getAllByTestId('queued-message-row')).toHaveLength(1);
  });
});
