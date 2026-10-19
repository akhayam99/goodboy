// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { ChatMessage } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore } from '../../../../store/storyHarness';
import { chatIdOf, chatMessageIdOf, isoDateTimeOf } from '../../../../__tests__/helpers/brandedIds';
import { liveTextRegistry } from '../../../chat/reveal/liveTextRegistry';
import { revealPacer } from '../../../chat/reveal/revealPacer';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { ChatAssistantMessage } from './ChatAssistantMessage';

const MESSAGE_ID = chatMessageIdOf({ value: 'reply-1' });
const AT = isoDateTimeOf({ value: '2026-10-19T09:00:00.000Z' });
const ANSWER = Array.from(
  { length: 30 },
  (_, index) => `Cascadia step ${index} keeps notify-relay quiet.`,
).join(' ');

const replyOf = ({ content, status }: Pick<ChatMessage, 'content' | 'status'>): ChatMessage => ({
  id: MESSAGE_ID,
  chatId: chatIdOf({ value: 'chat-1' }),
  role: 'assistant',
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

const shown = ({ container }: { readonly container: HTMLElement }): string =>
  container.querySelector('p')?.textContent ?? '';

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

describe('ChatAssistantMessage text reveal', () => {
  it('writes streamed text in behind the stream and holds the meta row until it ends', () => {
    const { container, rerender } = render(
      <ChatAssistantMessage
        message={replyOf({ content: '', status: 'streaming' })}
        workspaceName="Harborline"
      />,
    );
    liveTextRegistry.mark({ runId: MESSAGE_ID });
    rerender(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'streaming' })}
        workspaceName="Harborline"
      />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(shown({ container }).length).toBeGreaterThan(0);
    expect(shown({ container }).length).toBeLessThan(ANSWER.length);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    rerender(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'done' })}
        workspaceName="Harborline"
      />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('shows a stored answer whole, with its copy button, at once', () => {
    const { container } = render(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'done' })}
        workspaceName="Harborline"
      />,
    );

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('shows text at once under reduced motion', () => {
    setReducedMotion({ isReduced: true });
    liveTextRegistry.mark({ runId: MESSAGE_ID });
    const { container } = render(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'done' })}
        workspaceName="Harborline"
      />,
    );

    expect(shown({ container })).toBe(ANSWER);
  });

  it('shows everything when the reply is stopped mid reveal', () => {
    const { container, rerender } = render(
      <ChatAssistantMessage
        message={replyOf({ content: '', status: 'streaming' })}
        workspaceName="Harborline"
      />,
    );
    liveTextRegistry.mark({ runId: MESSAGE_ID });
    rerender(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'streaming' })}
        workspaceName="Harborline"
      />,
    );

    act(() => {
      revealPacer.flushRun({ runId: MESSAGE_ID });
    });
    rerender(
      <ChatAssistantMessage
        message={replyOf({ content: ANSWER, status: 'stopped' })}
        workspaceName="Harborline"
      />,
    );

    expect(shown({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });
});
