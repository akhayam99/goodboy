// @vitest-environment happy-dom

type DragHandler = (event: { readonly payload: unknown }) => void;

const { dragHandlers, invokeMock } = vi.hoisted(() => ({
  dragHandlers: new Set<DragHandler>(),
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
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
import type { AgentId, Session } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { AppStore } from '../../../../store/store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import { SessionDraftPane } from '.';

let useAppStore: StoryStore;
let cameFrom: Session;

const GOAL = 'Stop retried webhooks posting a second credit in payments-api';
const DROPPED = '/Users/harborline/Desktop/ledger-core-chart.png';
const WAIT = { timeout: 10_000 };

const spawnAgent = vi.fn<AppStore['spawnAgent']>();
const addGoalAttachments = vi.fn<AppStore['addGoalAttachments']>();

const startThenRun: AppStore['startSessionFromDraft'] = async ({ start }) => {
  if (start.kind === 'workflow-run') {
    await start.run(cameFrom);
  }
  if (start.kind === 'task' && start.then?.kind === 'workflow-run') {
    await start.then.run(cameFrom);
  }
  return cameFrom;
};

const noSetting: AppStore['loadSetting'] = async () => null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  dragHandlers.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation((command: unknown) => {
    if (command === 'attachment_read_dropped') {
      return Promise.resolve({
        fileName: 'ledger-core-chart.png',
        mimeType: 'image/png',
        dataBase64: 'aGk=',
      });
    }
    if (command === 'db_execute') {
      return Promise.resolve({ rowsAffected: 1 });
    }
    if (command === 'db_select') {
      return Promise.resolve([]);
    }
    return new Promise<never>(() => undefined);
  });
  const first = useAppStore.getState().sessions[0];
  if (first === undefined) {
    throw new Error('the board seed has no session');
  }
  cameFrom = first;
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  addGoalAttachments.mockReset();
  addGoalAttachments.mockResolvedValue(undefined);
  useAppStore.setState({
    spawnAgent,
    addGoalAttachments,
    startSessionFromDraft: startThenRun,
    loadSetting: noSetting,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const openPage = async (): Promise<void> => {
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId: cameFrom.id }) });
  useAppStore.getState().openSessionDraft();
  render(
    <ToastProvider>
      <SessionDraftPane workspaceId={WORKSPACE_ID} />
    </ToastProvider>,
  );
  await settle();
  const more = screen.queryByRole('button', { name: /^More/ });
  if (more !== null) {
    fireEvent.click(more);
  }
};

const goalBox = (): HTMLElement => screen.getByRole('textbox', { name: 'Goal' });

const goalField = (): HTMLElement => {
  const field = goalBox().closest<HTMLElement>('[data-drop-composer]');
  if (field === null) {
    throw new Error('the Goal field is not a drop target');
  }
  return field;
};

const image = (name: string): File => new File(['png'], name, { type: 'image/png' });

const dropFile = async (): Promise<void> => {
  await waitFor(() => expect(dragHandlers.size).toBeGreaterThan(0), WAIT);
  await act(async () => {
    for (const handler of dragHandlers) {
      handler({ payload: { type: 'drop', position: { x: 320, y: 200 }, paths: [DROPPED] } });
    }
  });
};

const pickAgent = async (): Promise<void> => {
  const kinds = screen.queryByRole('tablist', { name: 'What kind of run?' });
  if (kinds === null) {
    fireEvent.click(screen.getByRole('button', { name: /^How: / }));
  }
  fireEvent.click(
    within(screen.getByRole('tablist', { name: 'What kind of run?' })).getByRole('tab', {
      name: /^Agent/,
    }),
  );
  await settle();
};

const attachedNames = (): ReadonlyArray<string> =>
  (addGoalAttachments.mock.calls[0]?.[1] ?? []).map((input) => input.fileName);

describe('New session field attachments', () => {
  it('takes a pasted image and starts the Lead with it', async () => {
    await openPage();
    fireEvent.change(goalBox(), { target: { value: GOAL } });
    fireEvent.paste(goalBox(), { clipboardData: { files: [image('checkout-502.png')] } });

    await within(goalField()).findByRole('button', { name: 'Remove checkout-502.png' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1), WAIT);
    expect(addGoalAttachments).toHaveBeenCalledWith(
      { type: 'session', id: cameFrom.id },
      expect.any(Array),
    );
    expect(attachedNames()).toEqual(['checkout-502.png']);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove checkout-502.png' })).toBeNull(),
    );
  });

  it('takes an image pasted only as a clipboard item', async () => {
    await openPage();
    const pasted = image('northwind-trace.png');
    fireEvent.paste(goalBox(), {
      clipboardData: { files: [], items: [{ kind: 'file', getAsFile: () => pasted }] },
    });

    await within(goalField()).findByRole('button', { name: 'Remove northwind-trace.png' }, WAIT);
  });

  it('takes a dropped image and starts one agent with it', async () => {
    await openPage();
    await pickAgent();
    fireEvent.change(goalBox(), { target: { value: GOAL } });

    await dropFile();
    await within(goalField()).findByRole('button', { name: 'Remove ledger-core-chart.png' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1), WAIT);
    expect(attachedNames()).toEqual(['ledger-core-chart.png']);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove ledger-core-chart.png' })).toBeNull(),
    );
  });

  it('takes a file from the attach button', async () => {
    await openPage();
    within(goalField()).getByRole('button', { name: 'Attach files' });

    fireEvent.change(within(goalField()).getByLabelText('Choose files to attach'), {
      target: { files: [image('acme-dashboard.png')] },
    });

    await within(goalField()).findByRole('button', { name: 'Remove acme-dashboard.png' }, WAIT);
  });

  it('keeps the goal and the image when the start fails', async () => {
    const failing = vi.fn<AppStore['startSessionFromDraft']>();
    failing.mockRejectedValue(new Error('The folder is locked by another window'));
    useAppStore.setState({ startSessionFromDraft: failing });
    await openPage();
    fireEvent.change(goalBox(), { target: { value: GOAL } });
    fireEvent.paste(goalBox(), { clipboardData: { files: [image('checkout-502.png')] } });
    await within(goalField()).findByRole('button', { name: 'Remove checkout-502.png' }, WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(
      await screen.findByText('The folder is locked by another window', undefined, WAIT),
    ).toBeDefined();
    expect(
      within(goalField()).getByRole('button', { name: 'Remove checkout-502.png' }),
    ).toBeDefined();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Goal' }).value).toBe(GOAL);
  });

  it('says on the field when a file is too large, and keeps the other files', async () => {
    await openPage();
    fireEvent.paste(goalBox(), { clipboardData: { files: [image('checkout-502.png')] } });
    await within(goalField()).findByRole('button', { name: 'Remove checkout-502.png' }, WAIT);
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });

    fireEvent.paste(goalBox(), { clipboardData: { files: [huge] } });

    expect(await within(goalField()).findByRole('alert', undefined, WAIT)).toBeDefined();
    within(goalField()).getByRole('button', { name: 'Remove checkout-502.png' });
  });
});
