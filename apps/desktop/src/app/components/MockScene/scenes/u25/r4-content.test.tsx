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
import { requestRename } from '../../../../../shared/utils/renameRequest';
import { sessionObjectKey } from '../../../../../features/actions/kinds/session';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_R4_CONTENT_SCENES } from './r4-content';
import { CHAT_SESSION_ID, LENS_QUESTIONS } from '../flow-audit/fixtures';
import { agentPlace } from '../../../../../store/slices/navigation/place';

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
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
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

    expect(contextCards()).toEqual(['Goal', 'Decision records', 'Summary', 'Explanations']);
    document.querySelectorAll<HTMLElement>('[data-context-card]').forEach((card) => {
      expect(card.querySelector('[data-band] h2')).not.toBeNull();
    });
  });

  it('r4-context-summary keeps Learned for the summary block only', async () => {
    await mount('r4-context-summary');

    const summary = screen.getByRole('region', { name: 'Summary' });
    within(summary).getByText('Next');
    expect(within(summary).queryByRole('region', { name: 'State' })).toBeNull();
    screen.getByRole('region', { name: 'State' });
    expect(screen.getAllByText('Learned')).toHaveLength(1);
    within(summary).getByText('Learned');
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

    expect(
      [...document.querySelectorAll('[data-list-grid]')].map((list) =>
        list.getAttribute('aria-label'),
      ),
    ).toEqual(['Questions', 'Answered questions']);
    const grid = document.querySelector<HTMLElement>('[data-list-grid][aria-label="Questions"]');
    const groups = Array.from(grid?.querySelectorAll('h2') ?? []).map((node) => node.textContent);
    expect(groups[0]).toBe('Needs you');
    expect(screen.queryByText('No questions')).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('r4-questions-drawer opens the first question in the drawer', async () => {
    await mount('r4-questions-drawer');

    screen.getByRole('article');
    expect(document.querySelector('[data-list-grid-row][aria-current="true"]')).not.toBeNull();
  });

  it('r4-questions-drawer titles the drawer with the asker and age, the card with the question', async () => {
    await mount('r4-questions-drawer');

    const drawerTitle = document.querySelector('[data-container="detail"] h2')?.textContent ?? '';
    const card = screen.getByRole('article');
    expect(drawerTitle).toMatch(/^\S.* asks$/);
    expect(card.textContent ?? '').not.toContain(drawerTitle);
    const row = document.querySelector<HTMLElement>('[data-list-grid-row][aria-current="true"]');
    const question = row?.getAttribute('aria-label')?.split(', ')[0] ?? '';
    expect(question).not.toBe('');
    expect(drawerTitle).not.toContain(question);
    expect(card.textContent ?? '').toContain(question);
  });

  it('r4-questions-drawer links the asker: Implementer opens its conversation', async () => {
    await mount('r4-questions-drawer');
    const askerId = LENS_QUESTIONS[0]?.createdByAgentId;
    if (askerId === undefined) {
      throw new Error('no asker');
    }

    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });

    const link = screen.getByRole('button', { name: /^Open agent: / });
    expect(link.textContent).toBe('Implementer');
    expect(link.closest('h2')?.textContent).toBe('Implementer asks');
    await act(async () => {
      fireEvent.click(link);
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: CHAT_SESSION_ID, agentId: askerId }),
    });
  });

  it('r4-questions-drawer opens the asker from the row menu too', async () => {
    await mount('r4-questions-drawer');
    const askerId = LENS_QUESTIONS[0]?.createdByAgentId;
    if (askerId === undefined) {
      throw new Error('no asker');
    }
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    const row = document.querySelector<HTMLElement>('[data-list-grid-row][aria-current="true"]');
    if (row === null) {
      throw new Error('no open row');
    }

    await act(async () => {
      fireEvent.contextMenu(row);
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Open agent' }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: CHAT_SESSION_ID, agentId: askerId }),
    });
  });

  it('r4-questions-drawer names a deleted asker with no link and no menu verb', async () => {
    await mount('r4-questions-drawer');
    const askerId = LENS_QUESTIONS[0]?.createdByAgentId ?? null;
    act(() => {
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [CHAT_SESSION_ID]: (state.sessionPhaseRuns[CHAT_SESSION_ID] ?? []).map((agent) =>
            agent.id === askerId ? { ...agent, deletedAt: agent.startedAt } : agent,
          ),
        },
      }));
    });

    expect(screen.queryByRole('button', { name: /^Open agent: / })).toBeNull();
    const drawerTitle = document.querySelector('[data-container="detail"] h2')?.textContent ?? '';
    expect(drawerTitle).toBe('Implementer asks');
    const row = document.querySelector<HTMLElement>('[data-list-grid-row][aria-current="true"]');
    if (row === null) {
      throw new Error('no open row');
    }
    await act(async () => {
      fireEvent.contextMenu(row);
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    screen.getByRole('menuitem', { name: 'Open question' });
    expect(screen.queryByRole('menuitem', { name: 'Open agent' })).toBeNull();
  });

  it('r4-overview-title answers a rename for the open session on the Overview title', async () => {
    await mount('r4-overview-title');
    const sessionId = brandId<SessionId>({ value: 'mock-session-mount-rows' });
    const title = (): HTMLElement | null =>
      screen.queryByRole('heading', { level: 1 })?.querySelector('input') ?? null;

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
  });
});
