// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { brandId, type ChatMessage, type SessionId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../../store/storyHarness';
import {
  chatIdOf,
  chatMessageIdOf,
  isoDateTimeOf,
} from '../../../../../__tests__/helpers/brandedIds';
import { liveTextRegistry } from '../../../../chat/reveal/liveTextRegistry';
import { revealPacer } from '../../../../chat/reveal/revealPacer';
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
const REPLY_ID = chatMessageIdOf({ value: 'ask-reply-1' });
const AT = isoDateTimeOf({ value: '2026-10-19T09:00:00.000Z' });
const ANSWER = Array.from(
  { length: 30 },
  (_, index) => `Northwind step ${index} keeps notify-relay quiet.`,
).join(' ');
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

const replyOf = ({ content, status }: Pick<ChatMessage, 'content' | 'status'>): ChatMessage =>
  messageOf({ id: REPLY_ID, role: 'assistant', content, status });

const turnOf = ({ reply }: { readonly reply: ChatMessage }) => (
  <AskTurn
    sessionId={SESSION}
    question={QUESTION}
    reply={reply}
    facts={FACTS}
    onOpen={() => undefined}
  />
);

const shown = ({ container }: { readonly container: HTMLElement }): string =>
  container.querySelector('[data-testid="ask-answer"] p')?.textContent ?? '';

const setReducedMotion = ({ isReduced }: { readonly isReduced: boolean }): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  vi.useFakeTimers();
  liveTextRegistry.clear();
  revealPacer.reset();
  setReducedMotion({ isReduced: false });
});

afterEach(() => {
  cleanup();
  revealPacer.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AskTurn text reveal', () => {
  it('writes a live answer in with a fading tail and holds the footer until it ends', () => {
    const { container, rerender } = render(
      turnOf({ reply: replyOf({ content: '', status: 'streaming' }) }),
    );
    liveTextRegistry.mark({ runId: REPLY_ID });
    rerender(turnOf({ reply: replyOf({ content: ANSWER, status: 'streaming' }) }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(shown({ container }).length).toBeGreaterThan(0);
    expect(shown({ container }).length).toBeLessThan(ANSWER.length);
    expect(container.querySelector('[data-fresh]')).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    rerender(turnOf({ reply: replyOf({ content: ANSWER, status: 'done' }) }));
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows a stored answer whole at once', () => {
    const { container } = render(turnOf({ reply: replyOf({ content: ANSWER, status: 'done' }) }));

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[data-fresh]')).toBeNull();
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('shows a live answer whole under reduced motion', () => {
    setReducedMotion({ isReduced: true });
    liveTextRegistry.mark({ runId: REPLY_ID });
    const { container } = render(turnOf({ reply: replyOf({ content: ANSWER, status: 'done' }) }));

    expect(shown({ container })).toBe(ANSWER);
  });

  it('shows everything when the answer is stopped mid reveal', () => {
    const { container, rerender } = render(
      turnOf({ reply: replyOf({ content: '', status: 'streaming' }) }),
    );
    liveTextRegistry.mark({ runId: REPLY_ID });
    rerender(turnOf({ reply: replyOf({ content: ANSWER, status: 'streaming' }) }));

    act(() => {
      revealPacer.flushRun({ runId: REPLY_ID });
    });
    rerender(turnOf({ reply: replyOf({ content: ANSWER, status: 'stopped' }) }));

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });
});
