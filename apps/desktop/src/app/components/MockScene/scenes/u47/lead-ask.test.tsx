// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { LEAD_LONG_ANSWER } from './leadAskLongSeed';

const SETTLE_MS = 2_000;
const DOCK_TOP_PX = 500;
const DOCK_VIEW_PX = 320;
const FIELD_IN_DOCK_PX = 240;
const LINE_PX = 20;
const PAD_PX = 8;
const FIELD_MAX_PX = 6 * LINE_PX + 2 * PAD_PX;

type ScrollBox = {
  top: number;
};

type BindParams = {
  readonly element: HTMLElement;
  readonly box: ScrollBox;
};

type TextParams = {
  readonly text: string;
};

type Mounted = {
  readonly dock: HTMLElement;
  readonly field: HTMLTextAreaElement;
  readonly viewport: HTMLElement;
  readonly transcript: HTMLElement;
};

beforeAll(async () => {
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
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLSpanElement.prototype, 'offsetTop');
  Reflect.deleteProperty(HTMLSpanElement.prototype, 'offsetHeight');
});

const bindScrollTop = ({ element, box }: BindParams): void => {
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => box.top,
    set: (next: number) => {
      box.top = next;
    },
  });
};

const linesOf = ({ text }: TextParams): number => text.split('\n').length;

const mount = async (): Promise<Mounted> => {
  const Scene = MOCK_SCENES['u47-lead-ask-long-answer'];
  if (Scene === undefined) {
    throw new Error('no scene u47-lead-ask-long-answer');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  const dock = document.querySelector<HTMLElement>('[data-conversation-dock]');
  const transcript = document
    .querySelector<HTMLElement>('[data-scroll-content]')
    ?.closest<HTMLElement>('[data-page-scroller]');
  if (dock === null || transcript === null || transcript === undefined) {
    throw new Error('no dock or transcript');
  }
  const field = within(dock).getByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' });
  const viewport = field.closest<HTMLElement>('[data-conversation-dock] .overflow-y-auto');
  if (viewport === null) {
    throw new Error('no dock viewport');
  }
  return { dock, field, viewport, transcript };
};

describe('the u47 Lead asks scene with a long Something else answer', () => {
  it('docks the Lead question with the long answer open, under a composer that names the Lead', async () => {
    const { dock, field } = await mount();

    within(dock).getByText('Where should the payment retry live?');
    expect(field.value).toBe(LEAD_LONG_ANSWER);
    const composer = document.querySelector<HTMLTextAreaElement>('[data-composer-field] textarea');
    expect(composer?.placeholder).toBe('Message Lead');
  });

  it('typing past the field height moves only the dock, and the chat stays where it was', async () => {
    const { field, viewport, transcript } = await mount();
    const dockBox: ScrollBox = { top: 0 };
    const chatBox: ScrollBox = { top: 400 };
    const ownBox: ScrollBox = { top: 0 };
    bindScrollTop({ element: viewport, box: dockBox });
    bindScrollTop({ element: transcript, box: chatBox });
    bindScrollTop({ element: field, box: ownBox });
    viewport.style.overflowY = 'auto';
    const fieldHeight = (): number => linesOf({ text: field.value }) * LINE_PX + 2 * PAD_PX;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, get: () => DOCK_VIEW_PX },
      scrollHeight: { configurable: true, get: () => 640 },
      getBoundingClientRect: {
        configurable: true,
        value: () => DOMRect.fromRect({ y: DOCK_TOP_PX, height: DOCK_VIEW_PX }),
      },
    });
    Object.defineProperties(field, {
      clientHeight: { configurable: true, get: () => Math.min(FIELD_MAX_PX, fieldHeight()) },
      scrollHeight: { configurable: true, get: fieldHeight },
      clientWidth: { configurable: true, get: () => 320 },
      getBoundingClientRect: {
        configurable: true,
        value: () =>
          DOMRect.fromRect({
            y: DOCK_TOP_PX + FIELD_IN_DOCK_PX - dockBox.top,
            height: Math.min(FIELD_MAX_PX, fieldHeight()),
          }),
      },
    });
    Object.defineProperties(HTMLSpanElement.prototype, {
      offsetTop: {
        configurable: true,
        get(this: HTMLSpanElement) {
          return PAD_PX + (linesOf({ text: this.parentElement?.textContent ?? '' }) - 1) * LINE_PX;
        },
      },
      offsetHeight: { configurable: true, get: () => LINE_PX },
    });
    const text = `${LEAD_LONG_ANSWER}\nAnd keep the old retry flag off.`;

    await act(async () => {
      fireEvent.change(field, { target: { value: text } });
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const caretTop = PAD_PX + (linesOf({ text }) - 1) * LINE_PX;
    const caretInDock = FIELD_IN_DOCK_PX - dockBox.top + caretTop - ownBox.top;
    expect(field.value).toBe(text);
    expect(ownBox.top).toBeGreaterThan(0);
    expect(dockBox.top).toBeGreaterThan(0);
    expect(caretInDock + LINE_PX).toBeLessThanOrEqual(DOCK_VIEW_PX - 24);
    expect(chatBox.top).toBe(400);
  });
});
