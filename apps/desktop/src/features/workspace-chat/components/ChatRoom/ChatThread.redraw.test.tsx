// @vitest-environment happy-dom

const { holder, renders } = vi.hoisted(() => ({
  holder: { backend: null as ChatBackend | null },
  renders: [] as string[],
}));

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

vi.mock('../../hooks/useChatImageUrl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useChatImageUrl')>();
  return {
    ...actual,
    useChatImageUrl: (params: Parameters<typeof actual.useChatImageUrl>[0]) => {
      renders.push(params.attachmentId);
      return actual.useChatImageUrl(params);
    },
  };
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type {
  ChatAttachmentId,
  ChatId,
  ChatMessage,
  ChatMessageId,
  IsoDateTime,
} from '@goodboy/types';
import type { ChatBackend } from '../../chatBackend';
import { createMemoryChatBackend } from '../../createMemoryChatBackend';
import { ChatThread } from './ChatThread';

const CHAT = 'chat-images' as ChatId;
const AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;
const COUNT = 50;

const base = {
  chatId: CHAT,
  status: 'done',
  reads: [],
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
} as const;

const asked = (index: number): ChatMessage => ({
  ...base,
  id: `asked-${index}` as ChatMessageId,
  role: 'user',
  content: `Screenshot ${index}`,
  attachments: [
    {
      id: `image-${index}` as ChatAttachmentId,
      chatId: CHAT,
      messageId: `asked-${index}` as ChatMessageId,
      position: 0,
      fileName: `trace-${index}.png`,
      mimeType: 'image/png',
      byteSize: 4,
      createdAt: AT,
    },
  ],
});

const answered = (index: number, content: string): ChatMessage => ({
  ...base,
  id: `answer-${index}` as ChatMessageId,
  role: 'assistant',
  content,
  attachments: [],
});

const THREAD: ReadonlyArray<ChatMessage> = Array.from({ length: COUNT }, (_, index) => [
  asked(index),
  answered(index, `Answer ${index}`),
]).flat();

beforeEach(() => {
  renders.length = 0;
  const backend = createMemoryChatBackend({ respond: async () => ({ status: 'done' }) });
  holder.backend = backend;
  return Promise.all(
    Array.from({ length: COUNT }, (_, index) =>
      backend.writeImage({
        chatId: CHAT,
        attachmentId: `image-${index}` as ChatAttachmentId,
        fileName: `trace-${index}.png`,
        blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      }),
    ),
  );
});

afterEach(cleanup);

const thread = (messages: ReadonlyArray<ChatMessage>) => (
  <ChatThread
    messages={messages}
    workspaceName="Harborline"
    sessions={[]}
    onOpenSession={() => undefined}
  />
);

describe('ChatThread with images', () => {
  it('redraws only the streaming answer in a chat with 50 images', async () => {
    const streaming = answered(COUNT, '');
    const first = [...THREAD, asked(COUNT + 1), { ...streaming, status: 'streaming' as const }];
    const view = render(thread(first));
    await act(async () => undefined);
    expect(document.querySelectorAll('img').length).toBe(COUNT);
    const settled = renders.length;

    for (const text of ['The 502', 'The 502 comes from', 'The 502 comes from notify-relay.']) {
      const next = [
        ...first.slice(0, -1),
        { ...streaming, status: 'streaming' as const, content: text },
      ];
      view.rerender(thread(next));
    }
    await act(async () => undefined);

    expect(screen.getByText('The 502 comes from notify-relay.').textContent).toBe(
      'The 502 comes from notify-relay.',
    );
    expect(renders.length).toBe(settled);
  });

  it('shows an image again after a reload, and a placeholder for one that is gone', async () => {
    const lost = { ...asked(COUNT + 2), id: 'asked-lost' as ChatMessageId };
    render(thread([asked(0), lost]));
    await act(async () => undefined);
    expect(screen.getByRole('img', { name: 'trace-0.png' }).getAttribute('src')).toMatch(/^blob:/);
    expect(screen.getByLabelText('Image no longer on this computer').tagName.toLowerCase()).toBe(
      'svg',
    );
  });
});
