// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:00:00.000Z'));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type IsoDateTime, type Session, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../../store/storyHarness';
import type { BulkSessionResult } from '../../../../../../store/slices/sessions/types';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let DoneLaneMenu: typeof import('./index').DoneLaneMenu;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ DoneLaneMenu } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

type SessionParams = {
  readonly id: string;
  readonly updatedAt: string;
};

const sessionOf = ({ id, updatedAt }: SessionParams): Session =>
  aSession({
    id: brandId<SessionId>({ value: id }),
    goal: `Session ${id}`,
    createdAt: brandId<IsoDateTime>({ value: updatedAt }),
    updatedAt: brandId<IsoDateTime>({ value: updatedAt }),
  });

const FRESH = sessionOf({ id: 'fresh', updatedAt: '2026-10-17T10:00:00.000Z' });
const OLD = sessionOf({ id: 'old', updatedAt: '2026-10-01T10:00:00.000Z' });
const OLDER = sessionOf({ id: 'older', updatedAt: '2026-09-20T10:00:00.000Z' });

const bulkArchiveTask = vi.fn(
  async (ids: ReadonlyArray<SessionId>): Promise<BulkSessionResult> => ({
    succeeded: [...ids],
    failed: [],
  }),
);

const open = async ({ sessions }: { readonly sessions: ReadonlyArray<Session> }) => {
  act(() => {
    useAppStore.setState({ sessions: [...sessions], bulkArchiveTask });
  });
  render(
    <ToastProvider>
      <DoneLaneMenu sessions={sessions} />
    </ToastProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Done lane actions' }));
    await Promise.resolve();
  });
};

describe('the Done lane menu', () => {
  beforeEach(() => {
    bulkArchiveTask.mockClear();
  });

  it('offers Archive all in Done and Archive done older than 7 days', async () => {
    await open({ sessions: [FRESH, OLD, OLDER] });

    screen.getByRole('menuitem', { name: 'Archive all in Done' });
    screen.getByRole('menuitem', { name: 'Archive done older than 7 days' });
  });

  it('asks the shared archive confirm for every session, then archives them with Undo', async () => {
    await open({ sessions: [FRESH, OLD, OLDER] });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Archive all in Done' }));
      await Promise.resolve();
    });
    screen.getByText('Archive 3 sessions?');
    expect(bulkArchiveTask).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive 3 sessions' }));
      await Promise.resolve();
    });

    expect(bulkArchiveTask).toHaveBeenCalledWith([FRESH.id, OLD.id, OLDER.id]);
    screen.getByText('3 sessions archived');
    screen.getByRole('button', { name: 'Undo' });
  });

  it('archives only the sessions older than seven days from the second item', async () => {
    await open({ sessions: [FRESH, OLD, OLDER] });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Archive done older than 7 days' }));
      await Promise.resolve();
    });
    screen.getByText('Archive 2 sessions?');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive 2 sessions' }));
      await Promise.resolve();
    });

    expect(bulkArchiveTask).toHaveBeenCalledWith([OLD.id, OLDER.id]);
  });

  it('says so and disables the older item when nothing in Done is older', async () => {
    await open({ sessions: [FRESH] });

    const item = screen.getByRole('menuitem', { name: /Archive done older than 7 days/ });
    expect(item.getAttribute('aria-disabled')).toBe('true');
    screen.getByText('Nothing in Done is older than 7 days.');
  });

  it('keeps the sessions that failed in Done and says how many', async () => {
    bulkArchiveTask.mockResolvedValueOnce({ succeeded: [OLD.id], failed: [OLDER.id] });
    await open({ sessions: [OLD, OLDER] });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Archive all in Done' }));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive 2 sessions' }));
      await Promise.resolve();
    });

    screen.getByText("Couldn't archive everything. 1 of 2 stay in Done.");
  });
});
