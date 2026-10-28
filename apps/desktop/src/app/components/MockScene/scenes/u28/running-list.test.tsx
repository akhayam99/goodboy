// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U28_RUNNING_LIST_SCENES } from './running-list';

const KEYS = ['u28-running-list-light', 'u28-running-list-dark'];

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
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
});

type ShowParams = {
  readonly name: string;
};

const show = async ({ name }: ShowParams) => {
  const Scene = U28_RUNNING_LIST_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown running list scene');
  }
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

type SectionParams = {
  readonly id: string;
};

const sectionOf = ({ id }: SectionParams): HTMLElement => {
  const section = document.querySelector<HTMLElement>(`[data-live-section="${id}"]`);
  if (section === null) {
    throw new Error(`The ${id} section must be drawn`);
  }
  return section;
};

describe('the Running list scenes', () => {
  it('registers a light and a dark scene', () => {
    expect(Object.keys(U28_RUNNING_LIST_SCENES)).toEqual(KEYS);
    for (const [id, Scene] of Object.entries(U28_RUNNING_LIST_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('groups the rows by what you do next, in that order', async () => {
    await show({ name: KEYS[0] ?? '' });

    const running = screen.getByRole('region', { name: 'Running' });
    const ids = [...running.querySelectorAll('[data-live-section]')].map((node) =>
      node.getAttribute('data-live-section'),
    );
    expect(ids).toEqual(['needs-you', 'running', 'stopped']);
  });

  it('keeps a waiting or stopped item out of Running', async () => {
    await show({ name: KEYS[0] ?? '' });

    const running = within(sectionOf({ id: 'running' }));
    expect(running.queryByText('Fix the copy')).toBeNull();
    expect(running.queryByText('History rewriter')).toBeNull();
    expect(running.queryByText('Retry the ledger-core import')).toBeNull();
    within(sectionOf({ id: 'needs-you' })).getByText('Fix the copy');
    within(sectionOf({ id: 'needs-you' })).getByText('History rewriter');
    within(sectionOf({ id: 'stopped' })).getByText('Retry the ledger-core import');
  });

  it('says the status in one short word and moves the cause to a second line', async () => {
    await show({ name: KEYS[0] ?? '' });

    const rewriter = screen.getByRole('region', { name: 'History rewriter: History rewriter' });
    const row = rewriter.querySelector('[data-live-row]');
    expect(row?.textContent).toContain('Stopped');
    expect(row?.textContent).not.toContain('Stopped: origin moved');
    expect(row?.querySelector('[data-live-reason]')?.textContent).toBe('Origin moved');
  });

  it('draws a reason only on rows that wait or stopped, never on a working row', async () => {
    await show({ name: KEYS[0] ?? '' });

    const working = sectionOf({ id: 'running' });
    expect(working.querySelectorAll('[data-live-reason]')).toHaveLength(0);
  });

  it('gives every row one icon of the same treatment', async () => {
    await show({ name: KEYS[0] ?? '' });

    const rows = document.querySelectorAll('[data-overview-card="running"] [data-live-row]');
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      expect(row.querySelectorAll('[data-live-glyph]')).toHaveLength(1);
    }
  });

  it('puts the duration of a child row in the same place as the one of a parent row', async () => {
    await show({ name: KEYS[0] ?? '' });

    const rows = [...document.querySelectorAll('[data-overview-card="running"] [data-live-row]')];
    const children = rows.filter((row) => row.closest('[data-live-child]') !== null);
    expect(children.length).toBeGreaterThan(0);
    for (const row of rows) {
      const group = row.lastElementChild;
      expect(group?.children).toHaveLength(2);
      expect(group?.parentElement).toBe(row);
    }
    for (const row of rows) {
      const clock = row.querySelector('[data-delegation-clock]');
      if (clock !== null) {
        expect(row.lastElementChild?.lastElementChild?.contains(clock)).toBe(true);
      }
    }
  });

  it('draws the count for the two-step run and bars for the six-step run', async () => {
    await show({ name: KEYS[0] ?? '' });

    const copy = screen.getByRole('region', { name: 'Workflow: Fix the copy' });
    expect(copy.querySelector('[data-step-count]')?.textContent).toBe('1/2');
    const build = screen.getByRole('region', { name: 'Workflow: Build' });
    expect(build.querySelectorAll('[data-step-state]')).toHaveLength(6);
  });

  it('keeps one open button per row, covering the row', async () => {
    await show({ name: KEYS[0] ?? '' });

    for (const row of document.querySelectorAll('[data-live-row]')) {
      expect(row.querySelectorAll(':scope > [data-live-open]')).toHaveLength(1);
    }
  });

  it.each(KEYS)('%s has no accessibility violations', async (name) => {
    const { container } = await show({ name });
    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
