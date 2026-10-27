// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../../store/storyHarness')).workflowsModuleMock(),
);

const bus = vi.hoisted(() => ({
  emit: vi.fn(async (_name: string, _payload: unknown) => undefined),
  handlers: new Array<(event: { readonly payload: unknown }) => void>(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: bus.emit,
  listen: vi.fn(async (_name: string, handler: (event: { readonly payload: unknown }) => void) => {
    bus.handlers.push(handler);
    return () => undefined;
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  harborline,
  notifyRelay,
  openQuestionFor,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { useAttentionSync } from '.';

const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });

const retry = sessionOf({ goal: 'Pick the retry window for notify-relay' });
const webhook = sessionOf({ goal: 'Sign webhooks in payments-api' });

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  bus.handlers.length = 0;
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  seedColumn({
    store,
    sessions: [retry, webhook],
    mounts: [
      [retry, notifyRelay],
      [webhook, paymentsApi],
    ],
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

const ask = (sessions: ReadonlyArray<typeof retry>) => {
  act(() => {
    store.setState({
      sessionOpenQuestions: Object.fromEntries(
        sessions.map((session) => [session.id, [openQuestionFor({ sessionId: session.id })]]),
      ),
    });
  });
};

type RecordParams = {
  readonly value: unknown;
};

const recordOf = ({ value }: RecordParams): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value)) : {};

const sent = () =>
  bus.emit.mock.calls
    .filter(([name]) => name === 'goodboy:attention')
    .map(([, payload]) => recordOf({ value: payload }));

const deliver = (payload: Record<string, unknown>) => {
  act(() => {
    for (const handler of bus.handlers) {
      handler({ payload });
    }
  });
};

describe('useAttentionSync', () => {
  it('keeps the count of this window for its own workspace and sends it to the others', async () => {
    ask([retry, webhook]);
    renderHook(() => useAttentionSync());

    await waitFor(() =>
      expect(store.getState().attentionFromWindows[harborline.id]?.count).toBe(2),
    );
    expect(sent().at(-1)).toMatchObject({
      workspaceId: harborline.id,
      count: 2,
      tone: 'warning',
      reasonWords: ['1 question for you'],
    });
  });

  it('sends the new count again when it changes, down to nothing', async () => {
    ask([retry, webhook]);
    renderHook(() => useAttentionSync());
    await waitFor(() => expect(sent().at(-1)).toMatchObject({ count: 2 }));

    ask([]);

    await waitFor(() => expect(sent().at(-1)).toMatchObject({ count: 0, tone: null }));
    expect(store.getState().attentionFromWindows[harborline.id]?.count).toBe(0);
  });

  it('shows the count another window sends, for the workspace that window shows', async () => {
    renderHook(() => useAttentionSync());
    await waitFor(() => expect(bus.handlers.length).toBe(1));

    deliver({
      workspaceId: NORTHWIND,
      count: 3,
      tone: 'danger',
      reasonWords: ['Checks failing'],
      origin: 'window-northwind',
    });

    expect(store.getState().attentionFromWindows[NORTHWIND]).toEqual({
      count: 3,
      tone: 'danger',
      reasonWords: ['Checks failing'],
    });
  });

  it('reads the other workspaces from the database when it starts', async () => {
    storySpies.invokeWorkspacesAttention.mockResolvedValueOnce([
      {
        workspaceId: NORTHWIND,
        count: 2,
        tone: 'warning',
        reasons: ['open-question'],
      },
    ]);
    renderHook(() => useAttentionSync());

    await waitFor(() => expect(store.getState().attentionFromDatabase[NORTHWIND]?.count).toBe(2));
  });

  it('names the failure once and keeps the old counts when the database read fails', async () => {
    store.setState({
      attentionFromDatabase: { [NORTHWIND]: { count: 2, tone: 'warning', reasonWords: [] } },
      reportError: vi.fn(async () => undefined),
    });
    storySpies.invokeWorkspacesAttention.mockRejectedValueOnce(new Error('database is locked'));
    renderHook(() => useAttentionSync());

    await waitFor(() =>
      expect(store.getState().reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't read the other workspaces' counts",
          coalesceKey: 'attention-sync',
        }),
      ),
    );
    expect(store.getState().attentionFromDatabase[NORTHWIND]?.count).toBe(2);
  });

  it('names the failure when the other windows cannot be told', async () => {
    store.setState({ reportError: vi.fn(async () => undefined) });
    bus.emit.mockRejectedValue(new Error('event bus is closed'));
    ask([retry]);
    renderHook(() => useAttentionSync());

    await waitFor(() =>
      expect(store.getState().reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't share this workspace's count with other windows",
        }),
      ),
    );
    bus.emit.mockResolvedValue(undefined);
  });
});
