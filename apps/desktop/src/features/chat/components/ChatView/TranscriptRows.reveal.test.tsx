// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ProviderRunId } from '@goodboy/types';
import { nextAgentId, nextProviderRunId, nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../utils/transcript-items';
import type { ConversationRow } from '../../utils/conversationRows';
import { liveTextRegistry } from '../../reveal/liveTextRegistry';
import { revealPacer } from '../../reveal/revealPacer';

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
vi.mock('../../../../features/chat/turn', async () => {
  const actual = await vi.importActual<typeof import('../../turn')>('../../turn');
  return {
    ...(await import('../../../../store/storyHarness')).turnModuleMock(),
    encodeAuthRequiredMessage: actual.encodeAuthRequiredMessage,
    decodeAuthRequiredMessage: actual.decodeAuthRequiredMessage,
  };
});
vi.mock('../../../../features/permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../../features/providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../../features/providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../../features/budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../../features/skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../../features/workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../../features/worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../../features/plans/plans', async () =>
  (await import('../../../../store/storyHarness')).plansModuleMock(),
);

import { ToastProvider } from '../../../../shared/components/Toast';
import { TranscriptRows } from './TranscriptRows';

const SESSION = nextSessionId();
const AGENT = nextAgentId();
const ANSWER = Array.from(
  { length: 30 },
  (_, index) => `Harborline step ${index} keeps payments-api calm.`,
).join(' ');

let useAppStore: StoryStore;

const answerRow = ({ runId }: { readonly runId: ProviderRunId }): ConversationRow => {
  const item: TranscriptItem = { kind: 'assistant_text', key: 'text-7', text: ANSWER, runId };
  return { kind: 'item', key: item.key, item };
};

const renderAnswer = ({ runId }: { readonly runId: ProviderRunId }) =>
  render(
    <ToastProvider>
      <ul>
        <TranscriptRows
          rows={[answerRow({ runId })]}
          oqByTurnOrdinal={new Map()}
          sessionId={SESSION}
          selectedAgentId={AGENT}
          workingDir={null}
          onRefreshAuth={() => undefined}
          onOpenDiff={() => undefined}
          isThinking={false}
          thinkingPhrase="Thinking"
          onRetryRun={() => undefined}
          retryingRunId={null}
          activeRunId={null}
        />
      </ul>
    </ToastProvider>,
  );

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

const written = ({ container }: { readonly container: HTMLElement }): string =>
  container.querySelector('[data-block], p')?.textContent ?? '';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  vi.useFakeTimers();
  liveTextRegistry.clear();
  revealPacer.reset();
  setReducedMotion({ isReduced: false });
  useAppStore.setState({ viewFind: null });
});

afterEach(() => {
  cleanup();
  revealPacer.reset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('TranscriptRows text reveal', () => {
  it('writes the final answer in when it lands live, marks the row busy, then settles', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });
    const row = container.querySelector('[data-reveal-answer]');

    expect(row).not.toBeNull();
    expect(row?.getAttribute('aria-busy')).toBe('true');
    expect(written({ container })).toBe('');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    const partial = written({ container });
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan(ANSWER.length);
    expect(container.querySelector('[data-fresh]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[data-reveal-answer]')).toBeNull();
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('[data-fresh]')).toBeNull();
    expect(container.querySelector('[data-message-meta]')).not.toBeNull();
  });

  it('keeps the whole text in the DOM tree as plain text plus fresh spans', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const shown = written({ container });
    expect(ANSWER.startsWith(shown.trimEnd())).toBe(true);
    const freshText = [...container.querySelectorAll('[data-fresh]')]
      .map((span) => span.textContent ?? '')
      .join('');
    expect(shown.endsWith(freshText)).toBe(true);
  });

  it('shows an answer that was not written live whole, at once', () => {
    const runId = nextProviderRunId();
    const { container } = renderAnswer({ runId });

    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('[data-fresh]')).toBeNull();
  });

  it('shows an answer whose live window closed before the row mounted whole', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    vi.advanceTimersByTime(2000);
    const { container } = renderAnswer({ runId });

    expect(written({ container })).toBe(ANSWER);
  });

  it('shows the answer at once under reduced motion', () => {
    setReducedMotion({ isReduced: true });
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });

    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(container.querySelector('[data-fresh]')).toBeNull();
  });

  it('finishes the reveal on a click in the answer', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      fireEvent.pointerDown(container.querySelector('[data-reveal-answer]')!);
    });

    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('finishes the reveal when find in view starts', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      useAppStore.setState({
        viewFind: { query: 'payments-api', target: null, startedAt: 0, steps: 0 },
      });
    });

    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('finishes the reveal when the reader selects text in the answer', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container } = renderAnswer({ runId });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const paragraph = container.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = document.getSelection()!;

    act(() => {
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(written({ container })).toBe(ANSWER);
    expect(container.querySelector('[aria-busy]')).toBeNull();
  });

  it('clears the busy flag when the row unmounts mid reveal', () => {
    const runId = nextProviderRunId();
    liveTextRegistry.mark({ runId });
    const { container, unmount } = renderAnswer({ runId });
    expect(container.querySelector('[aria-busy]')).not.toBeNull();

    unmount();

    expect(revealPacer.snapshotOf({ key: `${runId}:text-7` })).toBeNull();
  });
});
