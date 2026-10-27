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
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { SendTurnResult } from '../../../../store/slices/turn/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { NAMES } from '../../../../shared/utils/names';
import { P21DrawerComposerScene } from '../../../../app/components/MockScene/scenes/u26/P21DrawerComposerScene';
import { IMPLEMENTER_ID } from '../../../../app/components/MockScene/scenes/u24/autoSceneSeed';

const WAIT = { timeout: 15_000 };
const DRAFT = 'Also cover the repeated key in applyCredit.';
const SINCE = brandId<IsoDateTime>({ value: '2026-10-13T12:09:16.000Z' });
const LANDED: SendTurnResult = { blockedOverBudget: false };
const BLOCKED: SendTurnResult = { blockedOverBudget: true };

type AppState = ReturnType<StoryStore['getState']>;

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation(() => new Promise<never>(() => undefined));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly sendTurn: AppState['sendTurn'];
};

const mountIdleChild = async ({ sendTurn }: MountParams) => {
  const sent = vi.fn<AppState['sendTurn']>(sendTurn);
  store.setState({ sendTurn: sent });
  render(
    <ToastProvider>
      <P21DrawerComposerScene theme="light" />
    </ToastProvider>,
  );
  const box = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error('Message Implementer is not a textarea');
  }
  act(() => {
    store.setState((state) => ({
      agentTurnState: {
        ...state.agentTurnState,
        [IMPLEMENTER_ID]: { kind: 'idle', lastActivityAt: SINCE },
      },
    }));
  });
  return { sent, box };
};

const clickSend = async () => {
  const buttons = await screen.findAllByRole('button', { name: NAMES.send });
  const enabled = buttons.filter(
    (button) => button instanceof HTMLButtonElement && !button.disabled,
  );
  expect(enabled).toHaveLength(1);
  await userEvent.click(enabled[0] ?? buttons[0] ?? document.body);
};

describe('the session composer when a send is refused', () => {
  it('puts the message back in the field and the draft when the budget blocks the send', async () => {
    const { sent, box } = await mountIdleChild({ sendTurn: async () => BLOCKED });

    await clickSend();

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(box.value).toBe(DRAFT));
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe(DRAFT);
  });

  it('does not overwrite what was typed while the send was pending', async () => {
    let settle: (result: SendTurnResult) => void = () => undefined;
    const { sent, box } = await mountIdleChild({
      sendTurn: () =>
        new Promise<SendTurnResult>((resolve) => {
          settle = resolve;
        }),
    });
    await clickSend();
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    fireEvent.change(box, { target: { value: 'a better message' } });

    await act(async () => {
      settle(BLOCKED);
      await Promise.resolve();
    });

    expect(box.value).toBe('a better message');
    expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBe('a better message');
  });

  it('clears the field and the draft once the send landed', async () => {
    const { sent, box } = await mountIdleChild({ sendTurn: async () => LANDED });

    await clickSend();

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBeUndefined());
    expect(box.value).toBe('');
  });

  it('shows the error with a Retry that sends the same message again', async () => {
    const attempts: string[] = [];
    const { sent, box } = await mountIdleChild({
      sendTurn: async ({ content }) => {
        attempts.push(content);
        if (attempts.length === 1) {
          throw new Error('provider refused the turn');
        }
        return LANDED;
      },
    });

    await clickSend();

    expect(await screen.findByText('provider refused the turn')).toBeTruthy();
    expect(box.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
    expect(attempts).toEqual([DRAFT, DRAFT]);
    await waitFor(() => expect(screen.queryByText('provider refused the turn')).toBeNull());
  });
});

describe('the session send button', () => {
  it('is the shared Send control, with the shared name and size', async () => {
    await mountIdleChild({ sendTurn: async () => LANDED });

    const buttons = await screen.findAllByRole('button', { name: NAMES.send });

    expect(buttons.map((button) => button.getAttribute('data-size'))).toEqual(
      buttons.map(() => 'sm'),
    );
  });
});
