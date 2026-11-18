// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { TRANSCRIPT_FLOOR_PX } from '../../../../../../features/chat/components/ChatView/useScrollPin';
import { installFakeResizeObserver } from '../../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../../..';
import { U31_CHAT_ANCHORING_SCENES } from './chat-anchoring';
import { SENT_QUESTION } from './chatAnchoringSeed';

const WAIT = { timeout: 15_000 };
const CLIENT_HEIGHT = 700;
const HEADER_INSET_PX = 120;
const TURN_TOP_PX = 900;

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
    expect(turns).toHaveLength(3);
    expect(turns[turns.length - 1]?.textContent).toContain(SENT_QUESTION);
    expect(container.querySelector('[data-dock-live]')?.textContent).toContain(
      'The Lead is answering',
    );
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

  it('lands the sent message under a pinned header inset, not under the header', async () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(CLIENT_HEIGHT);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(3000);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = real(element, pseudo);
      return element.querySelector('[data-scroll-content]') !== null
        ? new Proxy(style, {
            get: (target, key) =>
              key === 'paddingTop' ? `${HEADER_INSET_PX}px` : Reflect.get(target, key),
          })
        : style;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const top = this.hasAttribute('data-turn') ? TURN_TOP_PX : 0;
      return DOMRect.fromRect({ x: 0, y: top, width: 0, height: 60 });
    });
    const writes: number[] = [];
    const top = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: (value: number) => {
        writes.push(value);
      },
    });
    try {
      mount();
      await screen.findByText(SENT_QUESTION, undefined, WAIT);
      await waitFor(() => {
        expect(writes).toContain(TURN_TOP_PX - HEADER_INSET_PX);
      });
    } finally {
      if (top !== undefined) {
        Object.defineProperty(Element.prototype, 'scrollTop', top);
      }
    }
  });
});
