// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { TurnEvent } from '@goodboy/types';
import { nextAgentId, nextProviderRunId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listPendingSlackDraftsForSession: async () => [],
  }),
);
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
import { SESSION, SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { AgentTranscriptDrawer } from '.';

const PLANNER = nextAgentId();
const FAILED_CALL = 'toolu-harborline-1';
const REVEALED_TOP = 1000;
const END_TOP = 4500;
const REVEALED_NAME = 'Reveal at the earlier failed call';

const tops = new WeakMap<Element, number>();

let useAppStore: StoryStore;

const eventsOf = (): ReadonlyArray<TurnEvent> => {
  const runId = nextProviderRunId();
  const at = STORY_NOW;
  return [
    { kind: 'user_text', runId, text: 'Reconcile Northwind in ledger-core', at },
    ...[1, 2, 3].flatMap((index): ReadonlyArray<TurnEvent> => [
      {
        kind: 'tool_call_start',
        runId,
        toolUseId: `toolu-harborline-${index}`,
        toolName: 'Bash',
        input: { command: `pnpm test payments-api-${index}` },
        at,
      },
      {
        kind: 'tool_call_end',
        runId,
        toolUseId: `toolu-harborline-${index}`,
        output: 'Tests  1 failed',
        isError: index === 1,
        at,
      },
      { kind: 'assistant_text', runId, delta: `Batch ${index} checked. `, at },
    ]),
  ];
};

const installScrollMetrics = (): void => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => 5000,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 500,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: Element) {
      return tops.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      tops.set(this, Math.min(value, END_TOP));
    },
  });
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    const scroller = this.closest('.overflow-y-auto');
    if (scroller === null) {
      return;
    }
    tops.set(scroller, REVEALED_TOP);
    scroller.dispatchEvent(new Event('scroll'));
  };
};

const scrollerOf = ({ container }: { readonly container: HTMLElement }): Element => {
  const scroller = container.querySelector('.overflow-y-auto');
  if (scroller === null) {
    throw new Error(REVEALED_NAME);
  }
  return scroller;
};

const isFollowing = ({ container }: { readonly container: HTMLElement }): boolean =>
  container.querySelector('[data-jump-to-latest]')?.getAttribute('data-visible') !== 'true';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  installFakeResizeObserver();
  installScrollMetrics();
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: PLANNER },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        {
          id: PLANNER,
          sessionId: SESSION_ID,
          ordinal: 1,
          name: 'Planner',
          kind: 'planner',
          status: 'completed',
        },
      ],
    },
    transcripts: { [PLANNER]: eventsOf() },
    drawer: {
      kind: 'transcript',
      sessionId: SESSION_ID,
      payload: { agentId: PLANNER, toolUseId: FAILED_CALL },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTop');
});

describe('AgentTranscriptDrawer reveal through the scroll pin', () => {
  it('keeps an earlier failed call in view with follow off after the pin settles', () => {
    const { container } = render(
      <ToastProvider>
        <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={PLANNER} onClose={() => undefined} />
      </ToastProvider>,
    );
    const scroller = scrollerOf({ container });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.querySelector(`[data-tool-use-ids~="${FAILED_CALL}"]`)).not.toBeNull();
    expect(scroller.scrollTop).toBe(REVEALED_TOP);
    expect(isFollowing({ container })).toBe(false);
  });
});
