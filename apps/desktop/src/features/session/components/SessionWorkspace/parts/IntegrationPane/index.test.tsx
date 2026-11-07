// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type SessionExternalTask,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { sessionPlace, BOARD_PLACE } from '../../../../../../store/slices/navigation/place';
import { captureLocation } from '../../../../../../store/slices/navigation/captureLocation';
import { IntegrationPane } from '.';

const h = vi.hoisted(() => ({ replaceLinks: vi.fn(async () => true) }));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock({
    replaceSessionTaskLinks: h.replaceLinks,
  }),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'HAR-42',
  identifier: 'HAR-42',
  title: 'Keep one linked work list',
  url: 'https://linear.app/harborline/issue/HAR-42',
  createdAt: brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' }),
};
let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  h.replaceLinks.mockReset();
  h.replaceLinks.mockResolvedValue(true);
  store.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessionExternalTasks: { [SESSION_ID]: [TASK] },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
  });
  store.getState().navigate({
    to: sessionPlace({
      sessionId: SESSION_ID,
      lens: 'linear',
      target: {
        kind: 'external-task',
        task: { provider: 'linear', externalId: TASK.externalId, projectId: null },
      },
    }),
  });
});
afterEach(cleanup);

const mount = () =>
  render(<IntegrationPane sessionId={SESSION_ID} workspaceId={WORKSPACE_ID} provider="linear" />);
const requestUnlink = async () => {
  fireEvent.click(screen.getByRole('button', { name: `More actions for ${TASK.identifier}` }));
  expect(screen.getAllByRole('menuitem').length).toBeLessThanOrEqual(5);
  fireEvent.click(await screen.findByRole('menuitem', { name: /Remove link from this session/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Unlink' }));
};

describe('Linked work record', () => {
  it('keeps the record with one connection line and an external link when disconnected', () => {
    mount();
    screen.getByRole('heading', { name: TASK.title });
    screen.getByText('Connection lost. Open the record in its provider or reconnect in Settings.');
    screen.getByRole('button', { name: `Open ${TASK.identifier}` });
    expect(screen.queryByRole('button', { name: `View ${TASK.identifier}` })).toBeNull();
  });

  it('returns a provider list address to Overview', () => {
    store.getState().navigate({ to: sessionPlace({ sessionId: SESSION_ID, lens: 'linear' }) });
    expect(store.getState().activeLens[SESSION_ID]).toBeNull();
    expect(store.getState().focusedExternalTask[SESSION_ID] ?? null).toBeNull();
  });

  it('unlinks after success and lands on Overview, with app Undo restoring the link', async () => {
    mount();
    await requestUnlink();
    await waitFor(() => expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([]));
    expect(store.getState().activeLens[SESSION_ID]).toBeNull();
    await act(async () => {
      await store.getState().undoLastOperation({});
    });
    expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([TASK]);
  });

  it('stays on the record on failure and retries Unlink', async () => {
    h.replaceLinks.mockRejectedValueOnce(new Error('disk full'));
    mount();
    await requestUnlink();
    await screen.findByText('disk full');
    expect(store.getState().focusedExternalTask[SESSION_ID]?.externalId).toBe(TASK.externalId);
    expect(store.getState().sessionExternalTasks[SESSION_ID]).toEqual([TASK]);
    await requestUnlink();
    await waitFor(() => expect(store.getState().activeLens[SESSION_ID]).toBeNull());
  });

  it('keeps a later destination when unlink resolves after leaving the record', async () => {
    let finish: (isCommitted: boolean) => void = () => undefined;
    h.replaceLinks.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    await requestUnlink();
    act(() => {
      store.getState().navigate({ to: BOARD_PLACE });
    });
    await act(async () => {
      finish(true);
    });
    expect(captureLocation({ state: store.getState() }).place).toEqual(BOARD_PLACE);
  });

  it('keeps a drawer opened while the unlink was running', async () => {
    let finish: (isCommitted: boolean) => void = () => undefined;
    h.replaceLinks.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    await requestUnlink();
    act(() => {
      store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    });
    await act(async () => {
      finish(true);
    });
    expect(store.getState().drawer?.kind).toBe('ask');
    expect(store.getState().focusedExternalTask[SESSION_ID]?.externalId).toBe(TASK.externalId);
  });
});
