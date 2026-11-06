// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { queueOnlyInvoke } from '../../../../test/queueOnlyInvoke';
import { P21DrawerComposerScene } from '../../../../app/components/MockScene/scenes/u26/P21DrawerComposerScene';
import { IMPLEMENTER_ID } from '../../../../app/components/MockScene/scenes/u24/autoSceneSeed';

const WAIT = { timeout: 15_000 };
const DRAFT = 'Also cover the repeated key in applyCredit.';
const LIMIT = 'Every provider is over its limit. Change a limit or wait for the next period.';
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
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    queueOnlyInvoke({ command, args }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly sendTurn: AppState['sendTurn'];
};

const renderScene = () =>
  render(
    <ToastProvider>
      <P21DrawerComposerScene theme="light" />
    </ToastProvider>,
  );

const findBox = async (): Promise<HTMLTextAreaElement> => {
  const box = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error('Message Implementer is not a textarea');
  }
  return box;
};

const mountIdleChild = async ({ sendTurn }: MountParams) => {
  const sent = vi.fn<AppState['sendTurn']>(async (input) => {
    const result = await sendTurn(input);
    if (!result.blockedOverBudget) {
      input.onStarted?.();
    }
    return result;
  });
  store.setState({ sendTurn: sent });
  const view = renderScene();
  const box = await findBox();
  act(() => {
    store.setState((state) => ({
      agentTurnState: {
        ...state.agentTurnState,
        [IMPLEMENTER_ID]: { kind: 'idle', lastActivityAt: SINCE },
      },
    }));
  });
  return { sent, box, view };
};

const clickSend = async () => {
  const buttons = await screen.findAllByRole('button', { name: NAMES.send });
  const enabled = buttons.filter(
    (button) => button instanceof HTMLButtonElement && !button.disabled,
  );
  expect(enabled).toHaveLength(1);
  await userEvent.click(enabled[0] ?? buttons[0] ?? document.body);
};

const heldRow = async () => {
  const row = await screen.findByTestId('queued-message-row', undefined, WAIT);
  return {
    row,
    status: within(row).getByTestId('queued-message-status').textContent,
  };
};

describe('the session composer when a send is refused', () => {
  it('keeps the refused message in a Not delivered row and empties the box', async () => {
    const { sent, box } = await mountIdleChild({ sendTurn: async () => BLOCKED });

    await clickSend();

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    const { row, status } = await heldRow();
    expect(status).toBe('Not delivered');
    expect(row.getAttribute('data-status')).toBe('notDelivered');
    expect(within(row).getByText(DRAFT).textContent).toBe(DRAFT);
    expect(box.value).toBe('');
    expect(store.getState().agentQueue[IMPLEMENTER_ID]?.[0]?.hold?.reason).toBe(LIMIT);
  });

  it('sends the held message once more on Retry and then drops the row', async () => {
    const results = [BLOCKED, LANDED];
    const { sent } = await mountIdleChild({
      sendTurn: async () => results.shift() ?? LANDED,
    });
    await clickSend();
    const { row } = await heldRow();

    fireEvent.click(within(row).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
    expect(sent.mock.calls.map(([input]) => input.content)).toEqual([DRAFT, DRAFT]);
    await waitFor(() => expect(screen.queryByTestId('queued-message-row')).toBeNull());
  });

  it('puts the held message back in the box when its row is clicked', async () => {
    const { box } = await mountIdleChild({ sendTurn: async () => BLOCKED });
    await clickSend();
    const { row } = await heldRow();

    fireEvent.click(within(row).getByText(DRAFT));

    await waitFor(() => expect(box.value).toBe(DRAFT));
    expect(screen.queryByTestId('queued-message-row')).toBeNull();
  });

  it('keeps the row for a fresh composer of the same agent', async () => {
    const { view } = await mountIdleChild({ sendTurn: async () => BLOCKED });
    await clickSend();
    await heldRow();

    view.unmount();
    renderScene();
    await findBox();

    const { status } = await heldRow();
    expect(status).toBe('Not delivered');
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

  it('clears the field and the draft once the send landed, with no row left', async () => {
    const { sent, box } = await mountIdleChild({ sendTurn: async () => LANDED });

    await clickSend();

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(store.getState().agentDraft[IMPLEMENTER_ID]).toBeUndefined());
    expect(box.value).toBe('');
    await waitFor(() => expect(store.getState().agentQueue[IMPLEMENTER_ID]).toBeUndefined());
  });

  it('shows the error and keeps the message in a row with Retry when the send throws', async () => {
    const { sent } = await mountIdleChild({
      sendTurn: async () => {
        throw new Error('provider refused the turn');
      },
    });

    await clickSend();

    await waitFor(() => expect(sent).toHaveBeenCalledTimes(1));
    expect((await screen.findByText('provider refused the turn')).textContent).toBe(
      'provider refused the turn',
    );
    const { row, status } = await heldRow();
    expect(status).toBe('Not delivered');
    expect(within(row).getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(false);
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
