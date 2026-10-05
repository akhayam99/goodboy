// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { seedResolveGitlabScene } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
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

type Source = 'github' | 'gitlab' | 'local';

const mount = async ({ selected }: { readonly selected: Source }): Promise<void> => {
  seedResolveGitlabScene({ selected });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
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
  { source: 'github', first: /retryPolicy\.ts/, rows: 11 },
  { source: 'gitlab', first: /dispatch\.ts/, rows: 5 },
  { source: 'local', first: /retryPolicy\.ts/, rows: 2 },
];

describe.each(CASES)('Comments on the $source source', ({ source, first, rows }) => {
  it('lists the comments of the request and the local notes in one list', async () => {
    await mount({ selected: source });

    expect(rowsOf()).toHaveLength(rows);
    expect(rowsOf().some((text) => first.test(text))).toBe(true);
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
