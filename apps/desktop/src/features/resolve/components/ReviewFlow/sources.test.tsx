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
    </ToastProvider>,
  );
  await settle();
  const done = screen.queryByRole('button', { name: /^Done \d+/ });
  if (done !== null && done.getAttribute('aria-expanded') === 'false') {
    fireEvent.click(done);
  }
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const rowsOf = (): ReadonlyArray<string> =>
  Array.from(list().querySelectorAll('button[data-thread-id]')).map(
    (button) => button.textContent ?? '',
  );

const CASES: ReadonlyArray<{
  readonly source: Source;
  readonly first: RegExp;
  readonly rows: number;
}> = [
  { source: 'github', first: /retryPolicy\.ts/, rows: 9 },
  { source: 'gitlab', first: /dispatch\.ts/, rows: 3 },
];

describe.each(CASES)('Comments on the $source source', ({ source, first, rows }) => {
  it('lists the comments of the request only', async () => {
    await mount({ selected: source });

    expect(rowsOf()).toHaveLength(rows);
    expect(rowsOf().some((text) => first.test(text))).toBe(true);
  });

  it('lists none of the local notes, which live in the Notes drawer of Files', async () => {
    await mount({ selected: source });

    for (const note of NOTES) {
      expect(screen.queryByText(note.body, { exact: false })).toBeNull();
    }
    expect(rowsOf().every((text) => !text.includes('Local'))).toBe(true);
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
