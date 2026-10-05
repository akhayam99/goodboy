// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEFT_SIDEBAR_MAX } from '@goodboy/ui';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({
  threadId = null,
}: { readonly threadId?: string | null } = {}): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
};

const depthOf = (): number => {
  const state = useAppStore.getState();
  return state.navigation[state.currentWorkspaceId ?? '']?.entries.length ?? 0;
};

describe('Branch page header and tabs', () => {
  it('names the pull request and offers Comments, Files, Commits and Checks as tabs', async () => {
    await mount();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/#\d+/);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    expect(tabs.map((text) => text.replace(/\d+$/, '').trim())).toEqual([
      'Comments',
      'Files',
      'Commits',
      'Checks',
    ]);
    expect(screen.getByRole('tab', { name: /^Comments/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('carries one primary at most and none of the controls of the neighbouring pages', async () => {
    await mount();

    expect(document.querySelectorAll('[data-branch-primary]').length).toBeLessThanOrEqual(1);
    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.filter((name) => /^(Rewrite history|Open in Review|PR #\d+)/.test(name))).toEqual(
      [],
    );
  });

  it('switches tabs in the address without adding history', async () => {
    await mount();
    useAppStore.getState().navigate({
      to: {
        at: 'session',
        sessionId: SESSION.id,
        view: {
          lens: 'branch',
          agentId: null,
          studio: null,
          target: {
            kind: 'branch',
            mountPath: null,
            tab: 'comments',
            threadId: null,
            focus: null,
          },
        },
      },
    });
    const depth = depthOf();

    fireEvent.click(screen.getByRole('tab', { name: /^Checks/ }));
    await settle();

    expect(useAppStore.getState().branchTab[SESSION.id]).toBe('checks');
    expect(depthOf()).toBe(depth);
    expect(screen.getByRole('tab', { name: /^Checks/ }).getAttribute('aria-selected')).toBe('true');
  });
});

let observers: FakeResizeObservers | null = null;

const mountAt = async ({
  width,
  threadId = null,
}: {
  readonly width: number;
  readonly threadId?: string | null;
}): Promise<void> => {
  observers = installFakeResizeObserver();
  await mount({ threadId });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, width, 600),
  );
  act(() => observers?.resizeAll());
  await settle();
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observers = null;
});

describe('Branch page Comments', () => {
  it('opens a thread by putting it in the address, and Comments leads back to the list', async () => {
    await mountAt({ width: 384 });

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Comments' })).getAllByRole(
        'button',
      )[0] as HTMLElement,
    );
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id]).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Comments$/ }));
    await settle();
    expect(useAppStore.getState().branchThreadId[SESSION.id] ?? null).toBeNull();
  });

  it('keeps the selected thread on the list after Comments leads back', async () => {
    await mountAt({ width: 384 });
    const rows = within(screen.getByRole('navigation', { name: 'Comments' })).getAllByRole(
      'button',
    );
    const picked = rows[rows.length - 1] as HTMLElement;
    const threadId = picked.closest('[data-thread-id]')?.getAttribute('data-thread-id') ?? null;
    fireEvent.click(picked);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /^Comments$/ }));
    await settle();

    const list = within(screen.getByRole('navigation', { name: 'Comments' }));
    const current = list
      .getAllByRole('button')
      .map((row) => row.closest('[data-thread-id]'))
      .find((row) => row?.getAttribute('aria-current') === 'true');
    expect(current?.getAttribute('data-thread-id')).toBe(threadId);
  });

  it('shows one column on a pane under 900px: the list, or the open thread with Comments', async () => {
    await mountAt({ width: 384, threadId: EXPANDED_THREAD_ID });

    expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull();
    screen.getByRole('button', { name: /^Comments$/ });
    expect(screen.getAllByRole('group', { name: 'Comment properties' })).toHaveLength(1);
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('shows the list and the thread on a base pane, with the properties inside the thread', async () => {
    await mountAt({ width: 950, threadId: EXPANDED_THREAD_ID });

    screen.getByRole('navigation', { name: 'Comments' });
    expect(screen.queryByRole('button', { name: /^Comments$/ })).toBeNull();
    const groups = screen.getAllByRole('group', { name: 'Comment properties' });
    expect(groups).toHaveLength(1);
    within(groups[0] as HTMLElement).getByText('State');
    within(groups[0] as HTMLElement).getByText('Origin');
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('adds the properties rail only on a wide pane', async () => {
    await mountAt({ width: 1100, threadId: EXPANDED_THREAD_ID });

    screen.getByRole('navigation', { name: 'Comments' });
    const rail = screen.getByRole('complementary', { name: 'Thread details' });
    within(rail).getByText('State');
    expect(screen.getAllByRole('group', { name: 'Comment properties' })).toHaveLength(1);
  });

  it('reads one column in a 1024px window with a wide sidebar and an open drawer', async () => {
    await mountAt({ width: 1024 - LEFT_SIDEBAR_MAX, threadId: EXPANDED_THREAD_ID });
    useAppStore.getState().openDrawer({
      kind: 'conversation',
      sessionId: SESSION.id,
      payload: { threadId: EXPANDED_THREAD_ID },
    });
    await settle();

    expect(screen.queryByRole('navigation', { name: 'Comments' })).toBeNull();
    screen.getByRole('button', { name: /^Comments$/ });
    expect(screen.queryByRole('complementary', { name: 'Thread details' })).toBeNull();
  });

  it('keeps the description closed until it is asked for', async () => {
    await mount();

    const toggle = screen.getByRole('button', { name: 'Description' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('Branch page Checks and Files', () => {
  it('lists the checks of the pull request on its own tab', async () => {
    await mount();

    fireEvent.click(screen.getByRole('tab', { name: /^Checks/ }));
    await settle();

    expect(screen.getByRole('region', { name: 'Checks' })).toBeDefined();
  });

  it('explains there is no diff when the session has no worktree', async () => {
    await mount();

    fireEvent.click(screen.getByRole('tab', { name: /^Files/ }));
    await settle();

    expect(screen.getByText('No worktree for this session')).toBeDefined();
  });
});
