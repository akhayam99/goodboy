// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { TRANSCRIPT_FLOOR_PX } from '../../../../../features/chat/components/ChatView/useScrollPin';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_CHAT_ANCHORING_SCENES } from './chat-anchoring';
import { SENT_QUESTION } from './chatAnchoringSeed';

const WAIT = { timeout: 15_000 };
const CLIENT_HEIGHT = 700;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
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
  vi.restoreAllMocks();
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_CHAT_ANCHORING_SCENES['u31-chat-anchoring'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the chat anchoring scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_CHAT_ANCHORING_SCENES)).toEqual(['u31-chat-anchoring']);
    expect(MOCK_SCENES['u31-chat-anchoring']).toBe(U31_CHAT_ANCHORING_SCENES['u31-chat-anchoring']);
  });

  it('frames the capture on one element that holds the pane and nothing else', async () => {
    const { container } = mount();

    await screen.findByText(SENT_QUESTION, undefined, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.children).toHaveLength(1);
  });

  it('ends on the message just sent, as the last turn, with the live row under it', async () => {
    const { container } = mount();

    await screen.findByText(SENT_QUESTION, undefined, WAIT);
    const turns = container.querySelectorAll('[data-turn]');
    expect(turns).toHaveLength(4);
    expect(turns[turns.length - 1]?.textContent).toContain(SENT_QUESTION);
    expect(turns[turns.length - 1]?.textContent).toContain('Writing the answer');
  });

  it('makes room under the sent message and leaves Jump to latest hidden while it fits', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(CLIENT_HEIGHT);
    const { container } = mount();

    await screen.findByText(SENT_QUESTION, undefined, WAIT);
    const tail = container.querySelector<HTMLElement>('[data-transcript-tail]');
    await waitFor(() => {
      expect(Number.parseFloat(tail?.style.height ?? '0')).toBeGreaterThan(TRANSCRIPT_FLOOR_PX);
    });
    expect(container.querySelector('[data-jump-to-latest]')?.getAttribute('data-visible')).toBe(
      'false',
    );
  });
});
