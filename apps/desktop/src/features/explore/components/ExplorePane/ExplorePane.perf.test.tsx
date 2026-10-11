// @vitest-environment happy-dom

const h = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, sessionFixture } from '../../../../__tests__/helpers/actionFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { EXPLORE_ROW_PX } from '../../exploreRows';
import { ExplorePane } from '.';

let useAppStore: StoryStore;

const SESSION_ID: SessionId = SESSION;
const DIR = '/workspace/sessions/session-1';
const BIG = 3_000;
const VIEWPORT_PX = 600;
const MAX_ROWS_IN_DOM = 80;

const BIG_ROOT = Array.from({ length: BIG }, (_, index) => ({
  name: `chunk-${String(index).padStart(4, '0')}.js`,
  relPath: `chunk-${String(index).padStart(4, '0')}.js`,
  isDir: false,
  sizeBytes: 1024 + index,
  modifiedAt: '2026-09-14T15:40:00Z',
}));

const rowsInDom = (): number => screen.queryAllByRole('treeitem').length;

const viewportOf = (): HTMLElement => {
  const element = screen.getByRole('tree').parentElement;
  if (element === null) {
    throw new Error('The tree has no scroll viewport');
  }
  return element;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (command) => {
    if (command === 'explore_list') {
      return BIG_ROOT;
    }
    return [];
  });
  useAppStore.setState({ sessions: [sessionFixture()], currentSessionId: SESSION_ID });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => VIEWPORT_PX,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

const mount = () =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <ExplorePane sessionId={SESSION_ID} sessionDir={DIR} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );

describe('ExplorePane with a big folder', () => {
  it('keeps fewer than 80 rows in the DOM for a 3,000 entry folder', async () => {
    mount();
    await screen.findByRole('treeitem', { name: 'chunk-0000.js' });

    expect(rowsInDom()).toBeLessThan(MAX_ROWS_IN_DOM);
    expect(rowsInDom()).toBeGreaterThan(VIEWPORT_PX / EXPLORE_ROW_PX);
  });

  it('draws the rows near the scroll position and not the ones far above', async () => {
    mount();
    await screen.findByRole('treeitem', { name: 'chunk-0000.js' });
    const viewport = viewportOf();

    viewport.scrollTop = 1_500 * EXPLORE_ROW_PX;
    fireEvent.scroll(viewport);

    expect(await screen.findByRole('treeitem', { name: 'chunk-1500.js' })).toBeDefined();
    expect(screen.queryByRole('treeitem', { name: 'chunk-0000.js' })).toBeNull();
    expect(rowsInDom()).toBeLessThan(MAX_ROWS_IN_DOM);
  });

  it('reaches the last row with End and focuses it', async () => {
    mount();
    const first = await screen.findByRole('treeitem', { name: 'chunk-0000.js' });
    first.focus();
    const viewport = viewportOf();

    fireEvent.keyDown(first, { key: 'End' });
    viewport.scrollTop = BIG * EXPLORE_ROW_PX;
    fireEvent.scroll(viewport);

    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('chunk-2999.js'),
    );
    expect(rowsInDom()).toBeLessThan(MAX_ROWS_IN_DOM);
  });

  it('keeps one tab stop even when the active row is scrolled out of the DOM', async () => {
    mount();
    await screen.findByRole('treeitem', { name: 'chunk-0000.js' });
    const viewport = viewportOf();

    viewport.scrollTop = 2_000 * EXPLORE_ROW_PX;
    fireEvent.scroll(viewport);
    await screen.findByRole('treeitem', { name: 'chunk-2000.js' });

    const stops = [screen.getByRole('tree'), ...screen.getAllByRole('treeitem')].filter(
      (element) => element.tabIndex === 0,
    );
    expect(stops).toEqual([screen.getByRole('tree')]);
  });
});
