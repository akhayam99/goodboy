// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { ToastProvider } from '../../../../shared/components/Toast';
import { agentPlace } from '../../../../store/slices/navigation/place';
import type { SendTurnResult } from '../../../../store/slices/turn/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { queueOnlyInvoke } from '../../../../test/queueOnlyInvoke';
import { P10ChildComposerScene } from '../../../../app/components/MockScene/scenes/u36/P10ChildComposerScene';
import {
  AUTO_ROOT_ID,
  AUTO_SESSION,
  IMPLEMENTER_ID,
  TESTER_ID,
} from '../../../../app/components/MockScene/scenes/u24/autoSceneSeed';

const WAIT = { timeout: 15_000 };
const DRAFT = 'Also cover the repeated key in applyCredit.';
const IDLE_RESULT: SendTurnResult = { blockedOverBudget: false };

type AppState = ReturnType<StoryStore['getState']>;

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    queueOnlyInvoke({ command, args }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const boxOf = async ({ placeholder }: { readonly placeholder: string }) => {
  const box = await screen.findByPlaceholderText(placeholder, undefined, WAIT);
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error(`${placeholder} is not a textarea`);
  }
  return box;
};

const childBox = () => boxOf({ placeholder: 'Message Implementer' });

const autoBox = () => boxOf({ placeholder: 'Message Auto' });

const openAgent = ({ agentId }: { readonly agentId: AgentId }) => {
  act(() => {
    store.getState().navigate({ to: agentPlace({ sessionId: AUTO_SESSION.id, agentId }) });
  });
};

const mountScene = async () => {
  render(
    <ToastProvider>
      <P10ChildComposerScene theme="light" />
    </ToastProvider>,
  );
  return childBox();
};

type SpiesParams = {
  readonly sendTurn?: AppState['sendTurn'];
};

const spyOnActions = ({ sendTurn }: SpiesParams = {}) => {
  const sent = vi.fn<AppState['sendTurn']>(sendTurn ?? (async () => IDLE_RESULT));
  const queued = vi.fn<AppState['enqueueAgentMessage']>(store.getState().enqueueAgentMessage);
  const now = vi.fn<AppState['sendAgentMessageNow']>(async () => undefined);
  store.setState({ sendTurn: sent, enqueueAgentMessage: queued, sendAgentMessageNow: now });
  return { sent, queued, now };
};

const SINCE = brandId<IsoDateTime>({ value: '2026-10-13T12:09:16.000Z' });

const setChildTurn = ({ isRunning }: { readonly isRunning: boolean }) => {
  act(() => {
    store.setState((state) => ({
      agentTurnState: {
        ...state.agentTurnState,
        [IMPLEMENTER_ID]: isRunning
          ? {
              kind: 'running',
              runId: brandId<ProviderRunId>({ value: 'mock-run' }),
              startedAt: SINCE,
            }
          : { kind: 'idle', lastActivityAt: SINCE },
      },
    }));
  });
};

const enabledSend = async (): Promise<HTMLElement> => {
  const buttons = await screen.findAllByRole('button', { name: 'Send' });
  const enabled = buttons.filter(
    (button) => button instanceof HTMLButtonElement && !button.disabled,
  );
  expect(enabled).toHaveLength(1);
  return enabled[0] ?? buttons[0] ?? document.body;
};

describe('the child page composer names its agent', () => {
  it('keeps the child draft out of the Auto box', async () => {
    const box = await mountScene();

    expect(box.value).toBe(DRAFT);
    openAgent({ agentId: AUTO_ROOT_ID });
    expect((await autoBox()).value).toBe('');
    expect(store.getState().agentDraft[AUTO_ROOT_ID]).toBeUndefined();
  });

  it('shows one box on the child page', async () => {
    await mountScene();

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('Message Auto')).toBeNull();
  });

  it('types in the Auto box without touching the child draft', async () => {
    await mountScene();
    openAgent({ agentId: AUTO_ROOT_ID });

    fireEvent.change(await autoBox(), { target: { value: 'ship it after the review' } });

    expect(store.getState().agentDraft[AUTO_ROOT_ID]).toBe('ship it after the review');
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe(DRAFT);
    openAgent({ agentId: IMPLEMENTER_ID });
    expect((await childBox()).value).toBe(DRAFT);
  });

  it('keeps one draft per child across pages', async () => {
    await mountScene();
    openAgent({ agentId: TESTER_ID });

    const tester = await boxOf({ placeholder: 'Message Tester' });
    expect(tester.value).toBe('');
    fireEvent.change(tester, { target: { value: 'run the retry test twice' } });
    expect(store.getState().agentDraft[TESTER_ID]).toBe('run the retry test twice');
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe(DRAFT);

    openAgent({ agentId: IMPLEMENTER_ID });
    expect((await childBox()).value).toBe(DRAFT);
  });

  it('sends a stopped or done child its message, not Auto', async () => {
    const { sent } = spyOnActions();
    await mountScene();
    setChildTurn({ isRunning: false });

    await userEvent.click(await enabledSend());

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: AUTO_SESSION.id,
        agentId: IMPLEMENTER_ID,
        content: DRAFT,
      }),
    );
    await waitFor(() => expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBeUndefined());
  });

  it('queues for the running child', async () => {
    const { queued, now } = spyOnActions();
    await mountScene();

    await userEvent.click(await screen.findByRole('button', { name: /^Queue/ }));

    await waitFor(() => expect(queued).toHaveBeenCalledTimes(1));
    expect(queued).toHaveBeenCalledWith({
      turn: expect.objectContaining({ agentId: IMPLEMENTER_ID, content: DRAFT }),
    });
    expect(now).not.toHaveBeenCalled();
  });

  it('sends now to the running child', async () => {
    const { queued, now } = spyOnActions();
    await mountScene();

    await userEvent.click(await screen.findByRole('button', { name: /^Send now/ }));

    await waitFor(() => expect(now).toHaveBeenCalledTimes(1));
    expect(now).toHaveBeenCalledWith({
      sessionId: AUTO_SESSION.id,
      turn: expect.objectContaining({ agentId: IMPLEMENTER_ID, content: DRAFT }),
    });
    expect(queued).not.toHaveBeenCalled();
  });

  it('keeps the text in the box and says so when the message could not be saved', async () => {
    const failure = "The message couldn't be saved, so it was not sent.";
    store.setState({
      sendAgentMessage: async () => ({ isDelivered: false, failure, isUnwritten: true }),
    });
    await mountScene();
    setChildTurn({ isRunning: false });

    await userEvent.click(await enabledSend());

    await screen.findByText(failure, undefined, WAIT);
    expect((await childBox()).value).toBe(DRAFT);
  });

  it('restores attachments to the sending agent when persistence fails after switching pages', async () => {
    const attachment = {
      id: 'harborline-file',
      fileName: 'ledger-core.txt',
      mimeType: 'text/plain',
      relPath: 'attachments/ledger-core.txt',
    };
    let rejectSave: (reason: Error) => void = () => undefined;
    const save = vi.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    storySpies.tauriInvoke.mockImplementation((command, args) => {
      if (command === 'attachment_read') {
        return Promise.resolve('data:text/plain;base64,SGFyYm9ybGluZQ==');
      }
      if (
        command === 'db_transaction' &&
        isRecord(args) &&
        JSON.stringify(args).includes('agent_queued_messages')
      ) {
        return save();
      }
      return queueOnlyInvoke({ command, args });
    });
    store.setState({ agentAttachments: { [IMPLEMENTER_ID]: [attachment] } });
    await mountScene();
    setChildTurn({ isRunning: false });
    await screen.findByText('ledger-core.txt', undefined, WAIT);
    await userEvent.click(await enabledSend());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    openAgent({ agentId: TESTER_ID });
    await boxOf({ placeholder: 'Message Tester' });

    await act(async () => {
      rejectSave(new Error('The message could not be saved.'));
    });

    await waitFor(() =>
      expect(store.getState().agentAttachments[IMPLEMENTER_ID]).toEqual([attachment]),
    );
    expect(store.getState().agentAttachments[TESTER_ID] ?? []).toEqual([]);
    openAgent({ agentId: IMPLEMENTER_ID });
    await screen.findByText('ledger-core.txt', undefined, WAIT);
    expect((await childBox()).value).toBe(DRAFT);
  });

  it('drops the late failure of a page you left instead of showing it on another one', async () => {
    let fail: (reason: Error) => void = () => undefined;
    const { sent } = spyOnActions({
      sendTurn: () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    });
    await mountScene();
    setChildTurn({ isRunning: false });
    await userEvent.click(await enabledSend());
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));

    openAgent({ agentId: TESTER_ID });
    await screen.findByPlaceholderText('Message Tester', undefined, WAIT);
    await act(async () => {
      fail(new Error('provider refused the turn'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/provider refused the turn/)).toBeNull();
    expect(store.getState().agentDraft[TESTER_ID]).toBeUndefined();
    expect((await boxOf({ placeholder: 'Message Tester' })).value).toBe('');
  });
});
