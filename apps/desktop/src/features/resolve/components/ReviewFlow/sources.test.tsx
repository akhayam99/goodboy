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
import { ToastProvider } from '../../../../app/components/Toast';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { seedResolveGitlabScene } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { ReviewFlow } from './index';

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
      <ReviewFlow session={SESSION} />
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
  readonly picker: string;
  readonly first: RegExp;
  readonly rows: number;
}> = [
  { source: 'github', picker: 'payments-api #318', first: /retryPolicy\.ts/, rows: 9 },
  { source: 'gitlab', picker: 'notify-relay !57', first: /dispatch\.ts/, rows: 3 },
  { source: 'local', picker: 'Notes on this machine', first: /retryPolicy\.ts/, rows: 2 },
];

describe.each(CASES)('Review on the $source source', ({ source, picker, first, rows }) => {
  it('shows the picked source in the header and only its comments', async () => {
    await mount({ selected: source });

    expect(screen.getByRole('button', { name: `Review source: ${picker}` })).toBeDefined();
    expect(rowsOf()).toHaveLength(rows);
    expect(rowsOf().some((text) => first.test(text))).toBe(true);
  });

  it('keeps the summary line of the same states', async () => {
    await mount({ selected: source });

    expect(screen.getByLabelText('Comment summary').textContent).toMatch(/\d+ open/);
  });
});

describe('the source picker', () => {
  it('lists every request of the session with its provider and open count, notes last', async () => {
    await mount({ selected: 'github' });

    fireEvent.click(screen.getByRole('button', { name: /^Review source/ }));
    const options = await screen.findAllByRole('menuitemradio');

    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('payments-api #318 · GitHub'),
      expect.stringContaining('notify-relay !57 · GitLab3 open'),
      expect.stringContaining('Notes on this machine2 open'),
    ]);
    expect(options[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('swaps the list when another source is picked', async () => {
    await mount({ selected: 'github' });

    fireEvent.click(screen.getByRole('button', { name: /^Review source/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /notify-relay !57/ }));
    await settle();

    expect(useAppStore.getState().reviewSourceKeys[SESSION.id]).toBe('gitlab:session:57');
    expect(rowsOf()).toHaveLength(3);
  });

  it('names the merge request in the header link', async () => {
    await mount({ selected: 'gitlab' });

    expect(screen.getByRole('button', { name: 'Open merge request !57' })).toBeDefined();
  });
});
