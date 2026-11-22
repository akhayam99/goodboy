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
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { harborline, seedColumn, sessionOf } from '../../testing/sessionColumn';
import { SessionsHeader } from './SessionsHeader';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  seedColumn({
    store: useAppStore,
    sessions: [sessionOf({ goal: 'Fix webhook retries' })],
  });
});

afterEach(cleanup);

const mountHeader = () =>
  render(
    <ToastProvider>
      <SessionsHeader
        isShown
        workspaceId={harborline.id}
        filterSessions={[]}
        hiddenCount={0}
        needsYouElsewhere={0}
        onClearFilters={() => undefined}
      >
        {null}
      </SessionsHeader>
    </ToastProvider>,
  );

type IndexParams = {
  readonly index: number;
};

const triggers = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('button', { name: 'Filter sessions' });

const clickAt = ({ index }: IndexParams): void => {
  const trigger = triggers()[index];
  if (trigger === undefined) {
    throw new Error('no filter button at that place');
  }
  fireEvent.click(trigger);
};

const openAt = ({ index }: IndexParams): HTMLElement => {
  clickAt({ index });
  return screen.getByRole('dialog', { name: 'Filter sessions' });
};

describe('the Board holds the one session filter', () => {
  it('draws no view switch and one filter button, in the Board header', () => {
    mountHeader();

    expect(screen.queryByRole('tablist', { name: 'Sessions view' })).toBeNull();
    expect(triggers()).toHaveLength(1);
  });

  it('keeps the sort in the store for the workspace', () => {
    mountHeader();

    const dialog = openAt({ index: 0 });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('option', { name: 'Alphabetical' }));

    expect(useAppStore.getState().sessionViewPrefs[harborline.id]?.sort).toBe('goal');
  });

  it('keeps Mark all as read at the foot of the menu, off while nothing is unread', () => {
    mountHeader();

    const dialog = openAt({ index: 0 });
    const mark = within(dialog).getByRole('button', { name: 'Mark all as read' });

    expect(mark.hasAttribute('disabled')).toBe(true);
  });
});
