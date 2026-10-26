// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { DatabaseRecovery } from './';

const ERROR = 'Goodboy could not open its database. Your data is still in ~/.goodboy/data.db.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SeedParams = {
  readonly retryDatabaseOpen?: () => Promise<void>;
  readonly moveDatabaseAside?: () => Promise<void>;
};

const renderScreen = ({
  retryDatabaseOpen = async () => undefined,
  moveDatabaseAside = async () => undefined,
}: SeedParams = {}) => {
  useAppStore.setState({ retryDatabaseOpen, moveDatabaseAside });
  return render(<DatabaseRecovery error={ERROR} />);
};

const openConfirm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Move aside and restart' }));
  return screen.getByRole('group', { name: 'Move the database aside?' });
};

describe('the screen for a database that did not open', () => {
  it('offers Retry first, then Move aside and restart, then Report this', () => {
    renderScreen();

    const labels = within(screen.getByRole('alert'))
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(labels).toEqual(['Retry', 'Move aside and restart', 'Report this']);
    expect(screen.getByRole('button', { name: 'Retry' }).getAttribute('data-variant')).toBe(
      'primary',
    );
  });

  it('retries the open once per click', async () => {
    const retryDatabaseOpen = vi.fn(async () => undefined);
    renderScreen({ retryDatabaseOpen });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(retryDatabaseOpen).toHaveBeenCalledOnce();
  });

  it('says why it still cannot open and lets the person retry again', async () => {
    const retryDatabaseOpen = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('file is not a database'))
      .mockResolvedValueOnce(undefined);
    renderScreen({ retryDatabaseOpen });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    screen.getByText("Still can't open it: file is not a database");
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(retryDatabaseOpen).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Still can't open it/)).toBeNull();
  });

  it('asks before moving the file aside and says the copy is kept', () => {
    const moveDatabaseAside = vi.fn(async () => undefined);
    renderScreen({ moveDatabaseAside });

    const confirm = openConfirm();

    within(confirm).getByText('The copy stays next to a new empty database.');
    expect(moveDatabaseAside).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('goes back to Retry when the person cancels', () => {
    const moveDatabaseAside = vi.fn(async () => undefined);
    renderScreen({ moveDatabaseAside });
    openConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    screen.getByRole('button', { name: 'Retry' });
    expect(moveDatabaseAside).not.toHaveBeenCalled();
  });

  it('moves the file aside once, after the confirm', async () => {
    const moveDatabaseAside = vi.fn(async () => undefined);
    renderScreen({ moveDatabaseAside });
    const confirm = openConfirm();

    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Move aside and restart' }));
    });

    expect(moveDatabaseAside).toHaveBeenCalledOnce();
  });

  it('keeps the confirm open and says why when the move fails', async () => {
    renderScreen({
      moveDatabaseAside: async () => {
        throw new Error('permission denied');
      },
    });
    const confirm = openConfirm();

    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Move aside and restart' }));
    });

    within(confirm).getByText('permission denied');
  });
});
