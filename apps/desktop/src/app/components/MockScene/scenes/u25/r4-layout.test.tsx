// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { PAGE_MEASURE, type FramePage } from '@goodboy/ui';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U25_R4_LAYOUT_SCENES } from './r4-layout';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U25_R4_LAYOUT_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const pageHeaderOf = (container: Element): HTMLElement => {
  const scope = container.querySelector('[data-studio-frame]') ?? container;
  const titles = [...scope.querySelectorAll<HTMLElement>('h1')].filter(
    (title) => title.closest('.invisible, [inert], [hidden]') === null,
  );
  expect(titles).toHaveLength(1);
  const header = titles[0]?.closest<HTMLElement>('[data-page-header]') ?? null;
  if (header === null) {
    throw new Error('the page title sits outside the page header');
  }
  return header;
};

const DOOR_SCENES: ReadonlyArray<readonly [string, FramePage]> = [
  ['r4-layout-sessions', 'board'],
  ['r4-layout-tasks', 'inbox'],
  ['r4-layout-chat', 'chat'],
  ['r4-layout-workflows', 'workflows'],
  ['r4-layout-terminal', 'terminal'],
  ['r4-layout-monitoring', 'monitoring'],
  ['r4-layout-settings', 'settings'],
  ['r4-layout-guide', 'guideChapter'],
];

const LOADING_SCENES: ReadonlyArray<readonly [string, FramePage, string]> = [
  ['r4-layout-loading-workflows', 'workflows', 'rows'],
  ['r4-layout-loading-chat', 'chat', 'room'],
  ['r4-layout-loading-terminal', 'terminal', 'terminal'],
  ['r4-layout-loading-tasks', 'inbox', 'rows'],
];

describe('r4 layout scenes', () => {
  it('registers every scene', () => {
    for (const name of Object.keys(U25_R4_LAYOUT_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(DOOR_SCENES)('%s puts its title on the page header inset', async (name, page) => {
    const container = await mount(name);

    const header = pageHeaderOf(container);
    expect(header.getAttribute('data-page')).toBe(page);
    expect(header.className.split(' ')).toContain('pt-3');
    const column = header.closest('[data-page-column]');
    if (page === 'board') {
      expect(column).toBeNull();
      return;
    }
    expect(column?.getAttribute('data-width')).toBe(PAGE_MEASURE[page]);
  });

  it('puts the agent conversation of a session on the 720 measure, header included', async () => {
    const container = await mount('r4-layout-session');

    const header = pageHeaderOf(container);
    expect(header.closest('[data-page-column]')?.getAttribute('data-width')).toBe(
      PAGE_MEASURE.agent,
    );
  });

  it('puts the Terminal empty state on the title edge, not the panel edge', async () => {
    const container = await mount('r4-layout-terminal');

    const empty = screen.getByRole('heading', { name: 'No terminal yet' });
    const header = pageHeaderOf(container);
    expect(empty.closest('[data-page-column]')?.getAttribute('data-width')).toBe(
      header.closest('[data-page-column]')?.getAttribute('data-width'),
    );
  });

  it.each(LOADING_SCENES)('%s loads on its own page skeleton', async (name, page, shape) => {
    const container = await mount(name);

    expect(container.querySelector(`[data-studio-skeleton="${shape}"]`)).not.toBeNull();
    const skeleton = container.querySelector(`[data-page-skeleton="${page}"]`);
    expect(skeleton).not.toBeNull();
    expect(skeleton?.querySelector('[data-page-header]')?.className.split(' ')).toContain('pt-3');
  });

  it.each(Object.keys(U25_R4_LAYOUT_SCENES))('%s passes the a11y check', async (name) => {
    const container = await mount(name);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
