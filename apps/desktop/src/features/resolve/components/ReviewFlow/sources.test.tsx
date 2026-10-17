// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  NOTES,
  seedResolveGitlabScene,
} from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { BranchPage } from '../../../branch/components/BranchPage';
import { DrawerHost } from '../../../../app/components/DrawerHost';

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

type Source = 'github' | 'gitlab';

const mount = async ({ selected }: { readonly selected: Source }): Promise<void> => {
  seedResolveGitlabScene({ selected });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
  for (const group of [/^Done \d+/, /^Left open on \w+ \d+/]) {
    const toggle = screen.queryByRole('button', { name: group });
    if (toggle !== null && toggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(toggle);
    }
  }
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const rowsOf = (): ReadonlyArray<string> =>
  Array.from(
    screen
      .queryByRole('navigation', { name: 'Comments' })
      ?.querySelectorAll('button[data-thread-id]') ?? [],
  ).map((button) => button.textContent ?? '');

const rowsAcrossStates = (): ReadonlyArray<string> => {
  const open = rowsOf();
  const resolvedTab = screen.queryByRole('tab', { name: 'Resolved' });
  if (resolvedTab === null) {
    return open;
  }
  fireEvent.click(resolvedTab);
  const resolved = rowsOf();
  fireEvent.click(screen.getByRole('tab', { name: 'Open' }));
  return [...open, ...resolved];
};

const showHostOnly = (): void => {
  fireEvent.click(screen.getByRole('tab', { name: /^On (GitHub|GitLab)/ }));
};

const CASES: ReadonlyArray<{
  readonly source: Source;
  readonly first: RegExp;
  readonly rows: number;
}> = [
  { source: 'github', first: /retryPolicy\.ts/, rows: 9 },
  { source: 'gitlab', first: /dispatch\.ts/, rows: 3 },
];

describe.each(CASES)('Comments on the $source source', ({ source, first, rows }) => {
  it('lists the comments of the request only under its own name', async () => {
    await mount({ selected: source });
    showHostOnly();

    const listed = rowsAcrossStates();
    expect(listed).toHaveLength(rows);
    expect(listed.some((text) => first.test(text))).toBe(true);
  });

  it('lists the local notes beside the comments under All, each with its kind chip', async () => {
    await mount({ selected: source });

    const listed = rowsAcrossStates();
    expect(listed.length).toBe(rows + NOTES.length);
    expect(listed.filter((text) => text.includes('Note'))).toHaveLength(NOTES.length);
  });

  it('lists only the notes under Notes and counts each kind on its tab', async () => {
    await mount({ selected: source });

    expect(screen.getByRole('tab', { name: /^Notes/ }).textContent).toContain(String(NOTES.length));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));

    const listed = rowsAcrossStates();
    expect(listed).toHaveLength(NOTES.length);
    expect(listed.some((text) => text.includes('Note'))).toBe(false);
  });

  it('has no source picker and no pull request link of its own', async () => {
    await mount({ selected: source });

    expect(screen.queryByRole('button', { name: /^Review source/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Open (pull|merge) request/ })).toBeNull();
  });

  it('keeps the active source in the store without asking the user to pick it', async () => {
    await mount({ selected: source });

    expect(useAppStore.getState().reviewSourceKeys[SESSION.id]).toBeDefined();
  });
});
