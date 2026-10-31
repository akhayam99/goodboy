// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import type { WorkflowOrchestrationStop } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useOpenQuestions } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { BLOCKED_MOUNT_AGENT_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { U33_STOPPED_QUESTIONS_SCENES } from './stopped-questions';
import { STOPPED_FIRST_QUESTION_ID } from './stoppedQuestionsSeed';

const SCENE = 'u33-run-stopped-questions';
const SETTLE_MS = 2_000;

const pendingInvoke = () => new Promise<never>(() => undefined);

type StopCase = {
  readonly name: string;
  readonly stop: WorkflowOrchestrationStop;
  readonly phrase: string;
};

const STOP_CASES: ReadonlyArray<StopCase> = [
  {
    name: 'budget',
    stop: { kind: 'budget', message: 'Paused at the $5 limit for this session.' },
    phrase: 'Paused at the $5 limit for this session.',
  },
  {
    name: 'failure',
    stop: { kind: 'failure', message: 'the orchestrator reply could not be parsed' },
    phrase: 'Last decision failed: the orchestrator reply could not be parsed',
  },
  {
    name: 'operator',
    stop: { kind: 'operator', message: 'Stopped from the run page' },
    phrase: 'Stopped by you · the step in flight was skipped',
  },
  {
    name: 'needs-approval',
    stop: { kind: 'needs-approval', message: 'Deploy to Cascadia needs a go' },
    phrase: 'Paused · needs your approval',
  },
  {
    name: 'paused',
    stop: { kind: 'paused', message: 'Paused from the run page' },
    phrase: 'Paused by you',
  },
  {
    name: 'preset-change',
    stop: { kind: 'preset-change', message: 'The preset changed under the run' },
    phrase: 'Paused · the preset needs your call',
  },
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    turn_quiet: [],
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

type MountParams = {
  readonly stop?: WorkflowOrchestrationStop;
};

const mount = async ({ stop }: MountParams = {}): Promise<void> => {
  const Scene = U33_STOPPED_QUESTIONS_SCENES[SCENE];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  if (stop === undefined) {
    return;
  }
  await act(async () => {
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) => ({
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({ ...run, orchestrationStop: stop })),
      })),
    }));
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const clusters = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-run-open-question]'));

const tailLine = (): HTMLElement => {
  const line = document.querySelector<HTMLElement>('[aria-label="Run state"] [data-tail]');
  if (line === null) {
    throw new Error('the run page shows no run state line');
  }
  return line;
};

const runOf = () =>
  useAppStore.getState().sessions.find((session) => session.id === BLOCKED_MOUNT_SESSION_ID)
    ?.workflowRuns[0];

type ClickParams = {
  readonly node: HTMLElement;
};

const click = async ({ node }: ClickParams): Promise<void> => {
  await act(async () => {
    fireEvent.click(node);
  });
};

describe('the u33 stopped run questions scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U33_STOPPED_QUESTIONS_SCENES[SCENE]);
  });

  it('frames the stopped run in a 680px shot with padding on an inner element', async () => {
    await mount();
    const frame = document.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
  });

  it.each(STOP_CASES)('shows the $name stop and the open questions once', async (stopCase) => {
    await mount({ stop: stopCase.stop });

    expect(clusters()).toHaveLength(1);
    const cluster = clusters()[0]!;
    expect(cluster.dataset.runOpenQuestion).toBe(STOPPED_FIRST_QUESTION_ID);
    within(cluster).getByText('1 of 2');
    within(tailLine()).getByText(stopCase.phrase);
  });

  it('puts the questions before the stop line when they block the run', async () => {
    await mount();

    const position = clusters()[0]!.compareDocumentPosition(tailLine());
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the questions of a run the user closed', async () => {
    await mount({ stop: { kind: 'closed', message: 'Closed from the run page' } });

    expect(clusters()).toHaveLength(0);
    within(tailLine()).getByText('Closed by you');
  });

  it.each(STOP_CASES)(
    'keeps the $name stop on answering and sends the answers on resume',
    async (stopCase) => {
      await mount({ stop: stopCase.stop });
      const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
      const opened = useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? [];
      act(() => {
        useAppStore.setState({
          sendTurn,
          loadSessionOpenQuestions: async () => {
            useAppStore.setState({ sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] } });
          },
          loadSessionAnsweredQuestions: async () => {
            useAppStore.setState({
              sessionAnsweredQuestions: {
                [BLOCKED_MOUNT_SESSION_ID]: opened.map((question, index) => ({
                  ...question,
                  status: 'answered',
                  userAnswer: ['Batch them', '500 rows'][index] ?? null,
                })),
              },
            });
          },
        });
      });
      const block = clusters()[0]!;

      await click({ node: within(block).getByRole('radio', { name: 'Batch them' }) });
      await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
      await click({ node: within(block).getByRole('radio', { name: '500 rows' }) });
      await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });

      expect(sendTurn).not.toHaveBeenCalled();
      expect(runOf()?.orchestrationStop?.kind).toBe(stopCase.stop.kind);

      await act(async () => {
        useAppStore.setState((state) => ({
          sessions: state.sessions.map((session) => ({
            ...session,
            workflowRuns: session.workflowRuns.map(({ orchestrationStop, ...run }) => run),
          })),
        }));
        await useAppStore.getState().maybeAutoAdvanceWorkflow(BLOCKED_MOUNT_SESSION_ID);
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });

      expect(runOf()?.orchestrationStop).toBeUndefined();
      expect(sendTurn).toHaveBeenCalledTimes(1);
      expect(sendTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: BLOCKED_MOUNT_SESSION_ID,
          agentId: BLOCKED_MOUNT_AGENT_ID,
          content: expect.stringContaining('500 rows'),
        }),
      );
    },
  );

  it('keeps the typed answer, the stop and the questions when storing the answers fails', async () => {
    await mount();
    stubStoryInvoke({
      db_select: [],
      db_execute: () => {
        throw new Error('ledger-core is unreachable');
      },
      worktree_status: pendingInvoke,
      worktree_remote_url: pendingInvoke,
      worktree_changed_files: pendingInvoke,
      turn_quiet: [],
    });
    const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
    const reportError = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ sendTurn, reportError });
    });
    const block = clusters()[0]!;

    await click({ node: within(block).getByRole('radio', { name: 'Batch them' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
    await click({ node: within(block).getByRole('radio', { name: '500 rows' }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't send your answers" }),
    );
    expect(sendTurn).not.toHaveBeenCalled();
    expect(runOf()?.orchestrationStop?.kind).toBe('budget');
    expect(clusters()).toHaveLength(1);
    within(clusters()[0]!).getByRole('radio', { name: '500 rows', checked: true });
    within(clusters()[0]!).getByRole('button', { name: 'Answer' });
  });
});
