// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_MARKDOWN_BLOCKS_SCENES } from './markdown-blocks';

const WAIT = { timeout: 15_000 };
const HEADING = 'Why ledger-core rejects PR #309';

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
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_MARKDOWN_BLOCKS_SCENES['u31-markdown-blocks'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the markdown blocks scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_MARKDOWN_BLOCKS_SCENES)).toEqual(['u31-markdown-blocks']);
    expect(MOCK_SCENES['u31-markdown-blocks']).toBe(
      U31_MARKDOWN_BLOCKS_SCENES['u31-markdown-blocks'],
    );
  });

  it('frames the capture on one 680px element', async () => {
    const { container } = mount();

    await screen.findByText(HEADING, undefined, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.style.width).toBe('680px');
    expect(frames[0]?.children).toHaveLength(1);
  });

  it('opens each heading section with its heading, so the text after it belongs to it', async () => {
    const { container } = mount();

    await screen.findByText(HEADING, undefined, WAIT);
    const sections = [...container.querySelectorAll<HTMLElement>('[data-block="section"]')];
    expect(sections.map((section) => section.firstElementChild?.tagName)).toEqual([
      'H2',
      'H3',
      'H2',
    ]);
    expect(sections.map((section) => section.children.length)).toEqual([2, 2, 2]);
  });

  it('gives the code block its language, Wrap and Copy on its own surface', async () => {
    const { container } = mount();

    await screen.findByText(HEADING, undefined, WAIT);
    const block = container.querySelector<HTMLElement>('[data-block="code"]');
    expect(container.querySelectorAll('[data-block="code"]')).toHaveLength(1);
    expect(block?.querySelector('[data-slot="code-block-lang"]')?.textContent).toBe('sql');
    expect(
      within(block ?? container)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Wrap', 'Copy']);
    expect(block?.firstElementChild?.getAttribute('data-slot')).toBe('code-block-header');
  });

  it('wraps the long lines of the block on a click of Wrap and unwraps on the next', async () => {
    mount();

    const wrap = await screen.findByRole('button', { name: 'Wrap' }, WAIT);
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(wrap);
    expect(wrap.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(wrap);
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the whole answer with its code and table and no Show more', async () => {
    const { container } = mount();

    await screen.findByText(HEADING, undefined, WAIT);
    expect(container.querySelectorAll('[data-clamped="true"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Part 2: the follow-up' }).tagName).toBe('H2');
  });
});
