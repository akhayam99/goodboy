// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AppStore } from '../../../store/store';
import { ToastProvider } from '../../../shared/components/Toast';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { seedColumn, sessionOf } from '../../workspace/testing/sessionColumn';
import { SessionArchiveBridge } from './SessionArchiveBridge';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const live = sessionOf({ goal: 'Retry failed webhook deliveries' });

const mountBridge = () =>
  render(
    <ToastProvider>
      <SessionArchiveBridge />
    </ToastProvider>,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const press = async (): Promise<void> => {
  act(() => {
    pressShortcut({ id: 'session.archive' });
  });
  await settle();
};

type ArchiveMocks = {
  readonly bulkArchiveTask: ReturnType<typeof vi.fn<AppStore['bulkArchiveTask']>>;
  readonly bulkUnarchiveTask: ReturnType<typeof vi.fn<AppStore['bulkUnarchiveTask']>>;
};

const installArchiveMocks = (): ArchiveMocks => {
  const bulkArchiveTask = vi.fn<AppStore['bulkArchiveTask']>(async (ids) => ({
    succeeded: [...ids],
    failed: [],
  }));
  const bulkUnarchiveTask = vi.fn<AppStore['bulkUnarchiveTask']>(async (ids) => ({
    succeeded: [...ids],
    failed: [],
  }));
  useAppStore.setState({ bulkArchiveTask, bulkUnarchiveTask });
  return { bulkArchiveTask, bulkUnarchiveTask };
};

describe('the archive shortcut', () => {
  it('archives at once with no confirm when nothing is live, and Undo restores', async () => {
    seedColumn({ store: useAppStore, sessions: [live], currentSessionId: live.id });
    const { bulkArchiveTask, bulkUnarchiveTask } = installArchiveMocks();
    mountBridge();

    await press();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bulkArchiveTask).toHaveBeenCalledWith([live.id]);
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([live.id]);
  });

  it('with a live agent asks once, names what it stops, and Cancel archives nothing', async () => {
    seedColumn({ store: useAppStore, sessions: [live], currentSessionId: live.id });
    useAppStore.setState({
      sessionPhaseRuns: { [live.id]: [anAgent({ sessionId: live.id, status: 'running' })] },
    });
    const { bulkArchiveTask } = installArchiveMocks();
    mountBridge();

    await press();
    const dialog = await screen.findByRole('dialog', { name: 'Stop 1 agent and archive?' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    });

    expect(bulkArchiveTask).not.toHaveBeenCalled();
  });

  it('with a live agent archives on confirm, and Undo restores', async () => {
    seedColumn({ store: useAppStore, sessions: [live], currentSessionId: live.id });
    useAppStore.setState({
      sessionPhaseRuns: { [live.id]: [anAgent({ sessionId: live.id, status: 'running' })] },
    });
    const { bulkArchiveTask, bulkUnarchiveTask } = installArchiveMocks();
    mountBridge();

    await press();
    const dialog = await screen.findByRole('dialog', { name: 'Stop 1 agent and archive?' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Stop 1 agent and archive' }));
    });
    expect(bulkArchiveTask).toHaveBeenCalledWith([live.id]);

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    });
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([live.id]);
  });

  it('restores an archived session at once, with no confirm', async () => {
    const archived = {
      ...live,
      archivedAt: brandId<IsoDateTime>({ value: '2026-10-06T10:00:00.000Z' }),
    };
    seedColumn({ store: useAppStore, sessions: [], archived: [archived] });
    useAppStore.setState({ sessions: [archived], currentSessionId: archived.id });
    const { bulkArchiveTask, bulkUnarchiveTask } = installArchiveMocks();
    mountBridge();

    await press();

    expect(screen.queryByRole('dialog', { name: 'Archive session?' })).toBeNull();
    expect(bulkUnarchiveTask).toHaveBeenCalledWith([archived.id]);
    expect(bulkArchiveTask).not.toHaveBeenCalled();
  });
});
