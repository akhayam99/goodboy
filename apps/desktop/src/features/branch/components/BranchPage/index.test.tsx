// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Branch page Comments', () => {
  it('opens a thread by putting it in the address, and Comments leads back to the list', async () => {
    await mount();

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

  it('shows the properties of the open thread beside it and below it', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });

    const groups = screen.getAllByRole('group', { name: 'Comment properties' });
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(within(group).getByText('State')).toBeDefined();
      expect(within(group).getByText('Origin')).toBeDefined();
    }
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
