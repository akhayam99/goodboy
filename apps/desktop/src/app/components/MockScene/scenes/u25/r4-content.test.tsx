// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { requestRename } from '../../../../../features/actions/renameRequest';
import { sessionObjectKey } from '../../../../../features/actions/kinds/session';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_R4_CONTENT_SCENES } from './r4-content';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_R4_CONTENT_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_R4_CONTENT_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const contextCards = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-context-card]')).map(
    (card) => card.getAttribute('aria-label') ?? '',
  );

describe('the r4 content scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U25_R4_CONTENT_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('r4-context-cards draws Goal, Decisions, Summary and Explanations as cards', async () => {
    await mount('r4-context-cards');

    expect(contextCards()).toEqual(['Goal', 'Decisions', 'Summary', 'Explanations']);
    document.querySelectorAll<HTMLElement>('[data-context-card]').forEach((card) => {
      expect(card.querySelector('[data-band] h2')).not.toBeNull();
    });
  });

  it('r4-context-summary keeps Learned for the summary block only', async () => {
    await mount('r4-context-summary');

    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByText('State')).toBeDefined();
    expect(screen.getAllByText('Learned')).toHaveLength(1);
    expect(within(summary).getByText('Learned')).toBeDefined();
  });

  it('r4-overview-title titles the page with the session name after its linked key', async () => {
    await mount('r4-overview-title');

    const title = screen.getByTestId('overview-title');
    expect(title.closest('h1')).not.toBeNull();
    expect(within(title).getByText('HBL-391').hasAttribute('data-session-key')).toBe(true);
    expect(screen.queryByRole('heading', { level: 1, name: 'Overview' })).toBeNull();
  });

  it('r4-questions lists the questions on one grid, waiting first', async () => {
    await mount('r4-questions');

    expect(document.querySelectorAll('[data-list-grid]')).toHaveLength(1);
    const grid = document.querySelector<HTMLElement>('[data-list-grid]');
    const groups = Array.from(grid?.querySelectorAll('h2') ?? []).map((node) => node.textContent);
    expect(groups[0]).toBe('Needs you');
    expect(screen.queryByText('No questions')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('r4-questions-drawer opens the first question in the drawer', async () => {
    await mount('r4-questions-drawer');

    expect(screen.getByRole('article')).toBeDefined();
    expect(document.querySelector('[data-list-grid-row][aria-current="true"]')).not.toBeNull();
  });

  it('r4-questions-drawer titles the drawer with the asker and age, the card with the question', async () => {
    await mount('r4-questions-drawer');

    const drawerTitle = document.querySelector('[data-container="drawer"] h2')?.textContent ?? '';
    const card = screen.getByRole('article');
    expect(drawerTitle).toMatch(/^\S.* · \S+/);
    expect(card.textContent ?? '').not.toContain(drawerTitle);
    const row = document.querySelector<HTMLElement>('[data-list-grid-row][aria-current="true"]');
    const question = row?.getAttribute('aria-label')?.split(', ')[0] ?? '';
    expect(question).not.toBe('');
    expect(drawerTitle).not.toContain(question);
    expect(card.textContent ?? '').toContain(question);
  });

  it('r4-overview-title answers a rename for the open session on the Overview title', async () => {
    await mount('r4-overview-title');
    const sessionId = brandId<SessionId>({ value: 'mock-session-mount-rows' });
    const title = (): HTMLElement | null =>
      screen.queryByRole('heading', { level: 1 })?.querySelector('input') ?? null;
    const sidebarField = (): HTMLElement | null =>
      document.querySelector('[data-select-id] input, nav input[aria-label="Session title"]');

    act(() => {
      requestRename({ objectKey: sessionObjectKey({ sessionId }), anchorKey: null });
    });
    expect(title()).not.toBeNull();
    expect(screen.getAllByRole('textbox', { name: 'Session title' })).toHaveLength(1);
    const editing = title();
    if (editing === null) {
      throw new Error('the Overview title is not editing');
    }
    fireEvent.keyDown(editing, { key: 'Escape' });
    expect(title()).toBeNull();

    act(() => {
      requestRename({
        objectKey: sessionObjectKey({ sessionId }),
        anchorKey: `sidebar:${sessionId}`,
      });
    });
    expect(title()).not.toBeNull();
    expect(sidebarField()).toBeNull();
  });

  it('r4-overview-title renames a session whose Overview is not open on its sidebar row', async () => {
    await mount('r4-overview-title');
    const sibling = brandId<SessionId>({ value: 'mock-mounts-sibling-dunning' });

    act(() => {
      requestRename({
        objectKey: sessionObjectKey({ sessionId: sibling }),
        anchorKey: `sidebar:${sibling}`,
      });
    });

    const field = screen.getByRole('textbox', { name: 'Session title' });
    expect(field.closest('h1')).toBeNull();
    expect(field).toHaveProperty('value', 'Retry failed card payments on a dunning schedule');
  });

  it('r4-overview-title shows a sidebar rename pending, then its error with Retry', async () => {
    await mount('r4-overview-title');
    const sibling = brandId<SessionId>({ value: 'mock-mounts-sibling-dunning' });
    const answers: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
    const renameTask = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          answers.push({ resolve, reject });
        }),
    );
    useAppStore.setState({ renameTask });
    act(() => {
      requestRename({
        objectKey: sessionObjectKey({ sessionId: sibling }),
        anchorKey: `sidebar:${sibling}`,
      });
    });
    const field = screen.getByRole('textbox', { name: 'Session title' });
    fireEvent.change(field, { target: { value: 'Retry card payments on a schedule' } });

    const row = field.parentElement;
    if (row === null) {
      throw new Error('the rename field has no row');
    }
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(within(row).getByRole('status').textContent).toBe('Saving');
    expect(field.getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      answers[0]?.reject(new Error('The database is locked'));
    });

    expect(within(row).getByRole('alert').textContent).toContain('The database is locked');
    fireEvent.click(within(row).getByRole('button', { name: 'Retry' }));
    expect(renameTask).toHaveBeenCalledTimes(2);
    await act(async () => {
      answers[1]?.resolve();
    });

    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(within(row).queryByRole('alert')).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
