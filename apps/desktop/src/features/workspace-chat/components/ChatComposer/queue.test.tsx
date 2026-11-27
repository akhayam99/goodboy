// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type ChatId,
  type ChatMessageId,
  type ProviderRunId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ChatComposer } from '.';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'ws-harborline' });
const CHAT_A = brandId<ChatId>({ value: 'chat-consent' });
const CHAT_B = brandId<ChatId>({ value: 'chat-release' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const stream = {
  runId: brandId<ProviderRunId>({ value: 'run-1' }),
  messageId: brandId<ChatMessageId>({ value: 'message-1' }),
  isStopping: false,
};

type MountParams = {
  readonly chatId: ChatId;
  readonly isStreaming?: boolean;
};

const mount = ({ chatId, isStreaming = true }: MountParams) => {
  const sent: string[] = [];
  const view = render(
    <ChatComposer
      workspaceId={WORKSPACE_ID}
      chatId={chatId}
      placeholder="Ask about Harborline, read-only"
      routing={{ provider: 'anthropic', model: 'sonnet-5.5', effort: null }}
      isStreaming={isStreaming}
      isStopping={false}
      onSend={async (message) => {
        sent.push(message.text);
        useAppStore.getState().enqueueChatMessage({
          chatId,
          content: message.text,
          attachments: message.images,
        });
        return true;
      }}
      onStop={() => undefined}
      onRouting={() => undefined}
    />,
  );
  return { sent, view };
};

const png = (name: string) =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

const field = (): HTMLTextAreaElement => screen.getByRole('textbox', { name: 'Message' });

const rows = (): ReadonlyArray<HTMLElement> => screen.queryAllByTestId('queued-message-row');

const firstRow = (): HTMLElement => {
  const [row] = rows();
  if (row === undefined) {
    throw new Error('the tray has no row');
  }
  return row;
};

const type = (value: string): void => {
  fireEvent.change(field(), { target: { value } });
};

describe('the Chat composer queue', () => {
  it('queues what you type with Enter while an answer streams, and shows it in the tray', async () => {
    mount({ chatId: CHAT_A });
    type('and notify-relay?');

    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Enter' });
    });

    expect(field().value).toBe('');
    expect(rows()).toHaveLength(1);
    within(firstRow()).getByText('and notify-relay?');
    within(firstRow()).getByText('Waits for this reply');
  });

  it('keeps Stop beside the queued message', () => {
    useAppStore.setState({ chatStreams: { [CHAT_A]: stream } });
    mount({ chatId: CHAT_A });
    type('and notify-relay?');

    screen.getByRole('button', { name: 'Stop' });
    screen.getByRole('button', { name: 'Send' });
  });

  it('shows the queue of this chat only, and each chat keeps its own', async () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_B, content: 'for B', attachments: [] });
    const { view } = mount({ chatId: CHAT_A });
    expect(screen.queryByText('for B')).toBeNull();
    screen.getByText('for A');

    view.rerender(
      <ChatComposer
        workspaceId={WORKSPACE_ID}
        chatId={CHAT_B}
        placeholder="Ask about Harborline, read-only"
        routing={{ provider: 'anthropic', model: 'sonnet-5.5', effort: null }}
        isStreaming
        isStopping={false}
        onSend={async () => true}
        onStop={() => undefined}
        onRouting={() => undefined}
      />,
    );

    expect(screen.queryByText('for A')).toBeNull();
    screen.getByText('for B');
    expect(useAppStore.getState().chatQueues[CHAT_A]).toHaveLength(1);
  });

  it('removes a queued message from the tray', () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    mount({ chatId: CHAT_A });

    fireEvent.click(screen.getByRole('button', { name: 'Remove from queue' }));

    expect(rows()).toHaveLength(0);
    expect(useAppStore.getState().chatQueues).toEqual({});
  });

  it('moves a queued message back to the box on edit, and leaves the queue', () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    mount({ chatId: CHAT_A });

    fireEvent.click(screen.getByRole('button', { name: 'for A' }));

    expect(field().value).toBe('for A');
    expect(rows()).toHaveLength(0);
    expect(useAppStore.getState().chatQueues).toEqual({});
  });

  it('asks to clear the box before an edit', () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    mount({ chatId: CHAT_A });
    type('half a thought');

    expect(screen.getByRole('button', { name: 'for A' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows a failed send with its reason and Retry', () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    useAppStore.setState((state) => ({
      chatQueues: {
        [CHAT_A]: (state.chatQueues[CHAT_A] ?? []).map((turn) => ({
          ...turn,
          status: 'failed' as const,
          failure: 'disk full',
        })),
      },
    }));
    mount({ chatId: CHAT_A, isStreaming: false });

    screen.getByText('Not delivered');
    expect(screen.getByRole('alert').textContent).toContain('disk full');
    screen.getByRole('button', { name: 'Retry' });
  });

  it('keeps the same box, and its focus, when the first message joins the tray', () => {
    mount({ chatId: CHAT_A });
    const before = field();

    act(() => {
      useAppStore
        .getState()
        .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    });

    expect(rows()).toHaveLength(1);
    expect(field()).toBe(before);
  });

  it('does not edit a queued message over an image-only draft', async () => {
    useAppStore
      .getState()
      .enqueueChatMessage({ chatId: CHAT_A, content: 'for A', attachments: [] });
    mount({ chatId: CHAT_A });
    await act(async () => {
      fireEvent.paste(field(), { clipboardData: { files: [png('acme-trace.png')] } });
    });
    await screen.findByRole('button', { name: 'Remove acme-trace.png' });

    expect(screen.getByRole('button', { name: 'for A' }).hasAttribute('disabled')).toBe(true);
  });

  it('puts the images of an edited message back in the box with its text', async () => {
    useAppStore.getState().enqueueChatMessage({
      chatId: CHAT_A,
      content: 'for A',
      attachments: [
        {
          id: 'img-1',
          fileName: 'harborline-trace.png',
          mimeType: 'image/png',
          blob: png('harborline-trace.png'),
          relPath: null,
        },
      ],
    });
    mount({ chatId: CHAT_A });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'for A' }));
    });

    expect(field().value).toBe('for A');
    await screen.findByRole('button', { name: 'Remove harborline-trace.png' });
  });
});
