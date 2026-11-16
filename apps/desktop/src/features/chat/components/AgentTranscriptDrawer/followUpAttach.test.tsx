// @vitest-environment happy-dom

type DragHandler = (event: { readonly payload: unknown }) => void;

const { dragHandlers, invokeMock } = vi.hoisted(() => ({
  dragHandlers: new Set<DragHandler>(),
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
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
import { brandId, type Agent, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { ToastProvider } from '../../../../shared/components/Toast';
import { AgentTranscriptDrawer } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

const PLANNER = brandId<AgentId>({ value: 'agent-planner-attach' });
const DROPPED = '/Users/harborline/Desktop/ledger-core-chart.png';
const WAIT = { timeout: 10_000 };
const ASK = 'Use the chart for the retry backoff';

const PLANNER_AGENT: Agent = {
  id: PLANNER,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Planner',
  kind: 'planner',
  status: 'running',
};

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
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
    return new Promise<never>(() => undefined);
  });
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: null },
    sessionPhaseRuns: { [SESSION_ID]: [PLANNER_AGENT] },
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Pick<StoreState, 'sendAgentMessage' | 'reportError'>): void => {
  const state = useAppStore.getState();
  restore = { sendAgentMessage: state.sendAgentMessage, reportError: state.reportError };
  useAppStore.setState(actions);
};

const quietReport = vi.fn<StoreState['reportError']>(async () => undefined);

const renderDrawer = (): void => {
  render(
    <ToastProvider>
      <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={PLANNER} onClose={() => undefined} />
    </ToastProvider>,
  );
};

const replyBox = (): HTMLElement => screen.getByRole('textbox', { name: 'Message to Planner' });

const replyField = (): HTMLElement => {
  const field = replyBox().closest<HTMLElement>('[data-drop-composer]');
  if (field === null) {
    throw new Error('the reply field is not a drop target');
  }
  return field;
};

const image = (name: string): File => new File(['png'], name, { type: 'image/png' });

const sentNames = (send: ReturnType<typeof vi.fn<StoreState['sendAgentMessage']>>) =>
  (send.mock.calls[0]?.[0].turn.attachments ?? []).map((attachment) => attachment.fileName);

describe('agent follow-up attachments', () => {
  it('sends a pasted image with the message and clears it once saved', async () => {
    const sendAgentMessage = vi.fn<StoreState['sendAgentMessage']>(async () => ({
      isDelivered: true,
      failure: null,
    }));
    stub({ sendAgentMessage, reportError: quietReport });
    renderDrawer();
    fireEvent.change(replyBox(), { target: { value: ASK } });
    fireEvent.paste(replyBox(), { clipboardData: { files: [image('checkout-502.png')] } });
    await within(replyField()).findByRole('button', { name: 'Remove checkout-502.png' }, WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendAgentMessage).toHaveBeenCalledTimes(1), WAIT);
    expect(sentNames(sendAgentMessage)).toEqual(['checkout-502.png']);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove checkout-502.png' })).toBeNull(),
    );
  });

  it('takes a dropped image on the reply field', async () => {
    renderDrawer();
    await waitFor(() => expect(dragHandlers.size).toBeGreaterThan(0), WAIT);

    await act(async () => {
      for (const handler of dragHandlers) {
        handler({ payload: { type: 'drop', position: { x: 320, y: 200 }, paths: [DROPPED] } });
      }
    });

    await within(replyField()).findByRole('button', { name: 'Remove ledger-core-chart.png' }, WAIT);
  });

  it('keeps the text and the image when the message could not be saved', async () => {
    const sendAgentMessage = vi.fn<StoreState['sendAgentMessage']>(async () => ({
      isDelivered: false,
      failure: 'The queue is not writable.',
      isUnwritten: true,
    }));
    stub({ sendAgentMessage, reportError: quietReport });
    renderDrawer();
    fireEvent.change(replyBox(), { target: { value: ASK } });
    fireEvent.paste(replyBox(), { clipboardData: { files: [image('checkout-502.png')] } });
    await within(replyField()).findByRole('button', { name: 'Remove checkout-502.png' }, WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sendAgentMessage).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(useAppStore.getState().agentDraft[PLANNER]).toBe(ASK));
    within(replyField()).getByRole('button', { name: 'Remove checkout-502.png' });
  });
});
