// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { SendTurnResult } from '../../../../store/slices/turn/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { P21DrawerComposerScene } from '../../../../app/components/MockScene/scenes/u26/P21DrawerComposerScene';
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

const drawerBox = () => boxOf({ placeholder: 'Message Implementer' });

const mainBox = () => boxOf({ placeholder: 'Message Auto' });

const mountScene = async () => {
  render(
    <ToastProvider>
      <P21DrawerComposerScene theme="light" />
    </ToastProvider>,
  );
  return drawerBox();
};

type SpiesParams = {
  readonly sendTurn?: AppState['sendTurn'];
};

const spyOnActions = ({ sendTurn }: SpiesParams = {}) => {
  const sent = vi.fn<AppState['sendTurn']>(sendTurn ?? (async () => IDLE_RESULT));
  const queued = vi.fn<AppState['enqueueAgentMessage']>(async () => undefined);
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
  const buttons = await screen.findAllByRole('button', { name: 'Send message' });
  const enabled = buttons.filter(
    (button) => button instanceof HTMLButtonElement && !button.disabled,
  );
  expect(enabled).toHaveLength(1);
  return enabled[0] ?? buttons[0] ?? document.body;
};

describe('the child drawer composer names its agent', () => {
  it('keeps the drawer draft out of the main Auto composer', async () => {
    const drawer = await mountScene();

    const main = await mainBox();
    expect(drawer.value).toBe(DRAFT);
    expect(main.value).toBe('');
    expect(store.getState().agentDraft[AUTO_ROOT_ID]).toBeUndefined();
  });

  it('types in the main composer without touching the drawer draft', async () => {
    const drawer = await mountScene();
    const main = await mainBox();

    fireEvent.change(main, { target: { value: 'ship it after the review' } });

    expect(store.getState().agentDraft[AUTO_ROOT_ID]).toBe('ship it after the review');
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe(DRAFT);
    expect(drawer.value).toBe(DRAFT);
  });

  it('keeps one draft per child when the drawer switches', async () => {
    await mountScene();
    store.getState().openDrawer({
      kind: 'auto-child',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: TESTER_ID },
    });

    const tester = await boxOf({ placeholder: 'Message Tester' });
    expect(tester.value).toBe('');
    fireEvent.change(tester, { target: { value: 'run the retry test twice' } });
    expect(store.getState().agentDraft[TESTER_ID]).toBe('run the retry test twice');
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe(DRAFT);

    store.getState().openDrawer({
      kind: 'auto-child',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: IMPLEMENTER_ID },
    });
    expect((await drawerBox()).value).toBe(DRAFT);
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

  it('drops the late failure of a closed drawer instead of showing it in another one', async () => {
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

    store.getState().openDrawer({
      kind: 'auto-child',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: TESTER_ID },
    });
    await screen.findByPlaceholderText('Message Tester', undefined, WAIT);
    await act(async () => {
      fail(new Error('provider refused the turn'));
      await Promise.resolve();
    });

    expect(screen.queryByText(/provider refused the turn/)).toBeNull();
    expect(store.getState().agentDraft[TESTER_ID]).toBeUndefined();
    expect((await mainBox()).value).toBe('');
  });
});
