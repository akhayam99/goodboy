// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type ChatMessage, type ChatMessageId, type SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../../store/storyHarness';
import {
  chatIdOf,
  chatMessageIdOf,
  isoDateTimeOf,
} from '../../../../../__tests__/helpers/brandedIds';
import { NAMES } from '../../../../../shared/utils/names';
import type { AskButtonFacts } from '../../askButtons';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { AskTurn } from './AskTurn';

const SESSION = brandId<SessionId>({ value: 'session-webhooks' });
const AT = isoDateTimeOf({ value: '2026-10-19T09:00:00.000Z' });
const FACTS: AskButtonFacts = { openQuestions: [], messageableAgents: [], readyCount: 0 };

type MessageParams = Pick<ChatMessage, 'id' | 'role' | 'content' | 'status'>;

const messageOf = ({ id, role, content, status }: MessageParams): ChatMessage => ({
  id,
  chatId: chatIdOf({ value: 'ask-thread-1' }),
  role,
  content,
  status,
  reads: [],
  attachments: [],
  error: null,
  provider: null,
  model: null,
  effort: null,
  createdAt: AT,
  updatedAt: AT,
});

const QUESTION = messageOf({
  id: chatMessageIdOf({ value: 'ask-question-1' }),
  role: 'user',
  content: 'What needs me?',
  status: 'done',
});

const REPLY = messageOf({
  id: chatMessageIdOf({ value: 'ask-reply-1' }),
  role: 'assistant',
  content: 'Northwind retries wait on notify-relay.',
  status: 'done',
});

type MountParams = {
  readonly reply: ChatMessage;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const mount = ({ reply, onStartWork = () => undefined }: MountParams) =>
  render(
    <AskTurn
      sessionId={SESSION}
      question={QUESTION}
      reply={reply}
      facts={FACTS}
      onOpen={() => undefined}
      onStartWork={onStartWork}
    />,
  );

describe('Ask turn shares the Chat transcript parts', () => {
  beforeAll(async () => {
    await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  afterEach(cleanup);

  it('draws the question with the Chat user message', () => {
    const { container } = mount({ reply: REPLY });
    expect(container.querySelectorAll('[data-chat-message="user"]')).toHaveLength(1);
  });

  it('draws the question bubble lighter than the drawer so it reads as a turn', () => {
    const { container } = mount({ reply: REPLY });
    const bubble = container.querySelector('[data-chat-message="user"]');
    expect(bubble?.getAttribute('data-surface')).toBe('drawer');
  });

  it('offers one Start work from chat action on a finished answer', () => {
    const started: ChatMessageId[] = [];
    mount({ reply: REPLY, onStartWork: (messageId) => started.push(messageId) });
    const buttons = screen.getAllByRole('button', { name: NAMES.startWorkFromAsk });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(started).toEqual([REPLY.id]);
  });

  it('folds a raw provider error behind Details and keeps one plain sentence', () => {
    const raw = 'spawn claude ENOENT\n    at ChildProcess._handle.onexit (node:internal/x:1:1)';
    mount({ reply: { ...REPLY, content: '', status: 'failed', error: raw } });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No answer');
    expect(alert.textContent).toContain('The provider stopped without an answer.');
    expect(screen.queryByText(/ENOENT/u)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Details/u }));
    expect(screen.getByText(/ENOENT/u)).toBeDefined();
  });

  it('hides Start work while the answer is still streaming', () => {
    mount({ reply: { ...REPLY, status: 'streaming' } });
    expect(screen.queryByRole('button', { name: NAMES.startWorkFromAsk })).toBeNull();
  });
});
