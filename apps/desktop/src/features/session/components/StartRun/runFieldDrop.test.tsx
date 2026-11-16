// @vitest-environment happy-dom

type DragHandler = (event: { readonly payload: unknown }) => void;

const { dragHandlers } = vi.hoisted(() => ({ dragHandlers: new Set<DragHandler>() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: async () => undefined,
    onDragDropEvent: async (handler: DragHandler) => {
      dragHandlers.add(handler);
      return () => dragHandlers.delete(handler);
    },
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertSession, insertWorkspace } from '@goodboy/db';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StartRun } from './StartRun';

const WORKSPACE = aWorkspace({ name: 'Cascadia' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Refund retries' });
const AGENT = brandId<AgentId>({ value: 'agent-notify-relay' });
const QUESTION = 'Which notify-relay handler fires twice?';
const DROPPED = '/Users/harborline/Desktop/ledger-core-chart.png';
const WAIT = { timeout: 10_000 };

type StoryState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dragHandlers.clear();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: WORKSPACE });
  await insertSession(db, SESSION);
  const fallback = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) => {
    if (command === 'attachment_read_dropped') {
      return Promise.resolve({
        fileName: 'ledger-core-chart.png',
        mimeType: 'image/png',
        dataBase64: 'aGk=',
      });
    }
    return fallback === undefined ? Promise.resolve(null) : fallback(command, args);
  });
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE.id,
    sessions: [SESSION],
    workspaceOverrides: {},
    phaseTemplates: {},
  });
});

afterEach(cleanup);

const runField = (): HTMLElement => {
  const box = screen.getByRole('textbox', { name: 'Start a run' });
  const field = box.closest<HTMLElement>('[data-drop-composer]');
  if (field === null) {
    throw new Error('the run field is not a drop target');
  }
  return field;
};

describe('run field drop', () => {
  it('takes a dropped image and sends it with the run kickoff', async () => {
    const spawnAgent = vi.fn<StoryState['spawnAgent']>(async () => AGENT);
    const addGoalAttachments = vi.fn<StoryState['addGoalAttachments']>(async () => undefined);
    useAppStore.setState({ spawnAgent, addGoalAttachments });
    render(
      <ToastProvider>
        <StartRun workspaceId={WORKSPACE.id} sessionId={SESSION.id} />
      </ToastProvider>,
    );
    await waitFor(() => expect(dragHandlers.size).toBeGreaterThan(0), WAIT);

    await act(async () => {
      for (const handler of dragHandlers) {
        handler({ payload: { type: 'drop', position: { x: 320, y: 200 }, paths: [DROPPED] } });
      }
    });
    await within(runField()).findByRole('button', { name: 'Remove ledger-core-chart.png' }, WAIT);
    fireEvent.change(screen.getByRole('textbox', { name: 'Start a run' }), {
      target: { value: QUESTION },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Start/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1), WAIT);
    expect(addGoalAttachments).toHaveBeenCalledWith({ type: 'session', id: SESSION.id }, [
      expect.objectContaining({ fileName: 'ledger-core-chart.png', mimeType: 'image/png' }),
    ]);
  });
});
