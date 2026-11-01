// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { brandId, type OpenQuestionId, type WorkflowOrchestrationStop } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useOpenQuestions } from '../../../../../features/context/components/QuestionsTab/useOpenQuestions';
import { QuestionDrawer } from '../../../../../features/session/components/QuestionDrawer';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { StoppedPresetScene } from '../../../../../__tests__/helpers/StoppedPresetScene';
import { MOCK_SCENES } from '../..';
import { BLOCKED_MOUNT_AGENT_ID, BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { U33_STOPPED_QUESTIONS_SCENES } from './stopped-questions';
import { STOPPED_FIRST_QUESTION_ID, seedStoppedQuestions } from './stoppedQuestionsSeed';

const SCENE = 'u33-run-stopped-questions';
const SETTLE_MS = 2_000;
const ANSWERS = ['Batch them', '500 rows'];

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
    name: 'closed',
    stop: { kind: 'closed', message: 'Closed from the run page' },
    phrase: 'Closed by you',
  },
  {
    name: 'needs-approval',
    stop: { kind: 'needs-approval', message: 'Deploy to Cascadia needs a go' },
    phrase: 'Paused · needs your approval',
  },
  {
    name: 'plan-approval',
    stop: { kind: 'plan-approval', message: 'The plan is ready' },
    phrase: 'Plan ready · waiting for you',
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

const PAUSED: WorkflowOrchestrationStop = { kind: 'paused', message: 'Paused from the run page' };

let useAppStore: StoryStore;

const stubInvoke = () =>
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    turn_quiet: [],
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
  stubInvoke();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

type StopParams = {
  readonly stop: WorkflowOrchestrationStop | undefined;
};

const setStop = async ({ stop }: StopParams): Promise<void> => {
  await act(async () => {
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) => ({
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({ ...run, orchestrationStop: stop })),
      })),
    }));
  });
  await settle();
};

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
  await settle();
  if (stop !== undefined) {
    await setStop({ stop });
  }
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

type ClickParams = {
  readonly node: HTMLElement;
};

const click = async ({ node }: ClickParams): Promise<void> => {
  await act(async () => {
    fireEvent.click(node);
  });
};

type StubParams = {
  readonly count: number;
};

const stubAnswerStore = ({ count }: StubParams) => {
  const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
  const opened = (
    useAppStore.getState().sessionOpenQuestions[BLOCKED_MOUNT_SESSION_ID] ?? []
  ).slice(0, count);
  act(() => {
    useAppStore.setState({
      sendTurn,
      sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: opened },
      loadSessionOpenQuestions: async () => {
        useAppStore.setState({ sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] } });
      },
      loadSessionAnsweredQuestions: async () => {
        useAppStore.setState({
          sessionAnsweredQuestions: {
            [BLOCKED_MOUNT_SESSION_ID]: opened.map((question, index) => ({
              ...question,
              status: 'answered',
              userAnswer: ANSWERS[index] ?? null,
            })),
          },
        });
      },
    });
  });
  return sendTurn;
};

type AnswerParams = {
  readonly block: HTMLElement;
  readonly answers: ReadonlyArray<string>;
};

const answerAll = async ({ block, answers }: AnswerParams): Promise<void> => {
  for (const answer of answers) {
    await click({ node: within(block).getByRole('radio', { name: answer }) });
    await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
  }
  await settle();
};

type Outcome = {
  readonly sends: ReadonlyArray<unknown>;
  readonly pending: unknown;
  readonly answered: ReadonlyArray<unknown>;
};

type OutcomeParams = {
  readonly sendTurn: ReturnType<typeof stubAnswerStore>;
};

const outcomeOf = ({ sendTurn }: OutcomeParams): Outcome => {
  const state = useAppStore.getState();
  return {
    sends: sendTurn.mock.calls,
    pending: state.pendingOpenQuestionDeliveries[BLOCKED_MOUNT_SESSION_ID] ?? null,
    answered: (state.sessionAnsweredQuestions[BLOCKED_MOUNT_SESSION_ID] ?? []).map(
      (question) => question.userAnswer,
    ),
  };
};

describe('the u33 stopped run questions scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U33_STOPPED_QUESTIONS_SCENES[SCENE]);
  });

  it('frames the run tail in a 680px shot without the page chrome', async () => {
    await mount();
    const frame = document.querySelector<HTMLElement>('[data-shot]');
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
    expect(frame?.querySelector('[data-orchestrated-composer]')).not.toBeNull();
    expect(frame?.querySelector('[data-tail]')).not.toBeNull();
    expect(frame?.querySelector('[data-session-rail]')).toBeNull();
  });

  it.each(STOP_CASES)(
    'shows the $name stop line after the open questions, once',
    async (stopCase) => {
      await mount({ stop: stopCase.stop });

      expect(clusters()).toHaveLength(1);
      const cluster = clusters()[0]!;
      expect(cluster.dataset.runOpenQuestion).toBe(STOPPED_FIRST_QUESTION_ID);
      within(cluster).getByText('1 of 2');
      within(tailLine()).getByText(stopCase.phrase);
      expect(cluster.compareDocumentPosition(tailLine()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    },
  );

  it.each(STOP_CASES)('answers the questions on the $name stop with one send', async (stopCase) => {
    await mount({ stop: stopCase.stop });
    const sendTurn = stubAnswerStore({ count: 2 });
    const block = clusters()[0]!;

    expect(within(block).getByRole('button', { name: 'Answer' })).toHaveProperty('disabled', true);
    await answerAll({ block, answers: ANSWERS });

    expect(sendTurn).toHaveBeenCalledTimes(1);
    ANSWERS.forEach((answer) =>
      expect(sendTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: BLOCKED_MOUNT_AGENT_ID,
          content: expect.stringContaining(answer),
        }),
      ),
    );
    expect(clusters()).toHaveLength(0);
  });

  it.each(STOP_CASES)(
    'answers the same on the run page and in the Needs you drawer on the $name stop',
    async (stopCase) => {
      await mount({ stop: stopCase.stop });
      const onPage = stubAnswerStore({ count: 1 });
      await answerAll({ block: clusters()[0]!, answers: ANSWERS.slice(0, 1) });
      const pageOutcome = outcomeOf({ sendTurn: onPage });
      cleanup();

      await resetStoryStore();
      useOpenQuestions.setState({ drafts: {}, staged: [], pendingUndo: null });
      stubInvoke();
      seedStoppedQuestions({ stop: stopCase.stop });
      const inDrawer = stubAnswerStore({ count: 1 });
      const { container } = render(
        <ToastProvider>
          <QuestionDrawer
            sessionId={BLOCKED_MOUNT_SESSION_ID}
            questionId={brandId<OpenQuestionId>({ value: STOPPED_FIRST_QUESTION_ID })}
            from={null}
            onClose={() => undefined}
          />
        </ToastProvider>,
      );
      await settle();
      const card = container.querySelector<HTMLElement>('[data-question-card]');
      if (card === null) {
        throw new Error('the drawer shows no question card');
      }
      await answerAll({ block: card, answers: ANSWERS.slice(0, 1) });

      expect(pageOutcome.sends).toHaveLength(1);
      expect(outcomeOf({ sendTurn: inDrawer })).toEqual(pageOutcome);
    },
  );

  it('keeps the typed answer and the questions when storing the answers fails on a stop', async () => {
    await mount({ stop: STOP_CASES[0]!.stop });
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
    expect(clusters()).toHaveLength(1);
    within(clusters()[0]!).getByRole('radio', { name: '500 rows', checked: true });
  });
});

type PresetParams = {
  readonly status: 'running' | 'stopped';
};

const mountPreset = async ({ status }: PresetParams): Promise<void> => {
  seedStoppedQuestions({ stop: PAUSED });
  act(() => {
    useAppStore.setState((state) => ({
      sessionWorkflows: {
        [BLOCKED_MOUNT_SESSION_ID]: (state.sessionWorkflows[BLOCKED_MOUNT_SESSION_ID] ?? []).map(
          (workflow) => ({ ...workflow, origin: 'library' as const }),
        ),
      },
      sessions: state.sessions.map((session) => ({
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({
          ...run,
          executionMode: 'static' as const,
        })),
      })),
      sessionPhaseRuns: {
        [BLOCKED_MOUNT_SESSION_ID]: (state.sessionPhaseRuns[BLOCKED_MOUNT_SESSION_ID] ?? []).map(
          (agent) =>
            agent.id === BLOCKED_MOUNT_AGENT_ID
              ? { ...agent, status, ...(status === 'stopped' ? { stoppedBy: 'app' as const } : {}) }
              : agent,
        ),
      },
    }));
  });
  render(
    <ToastProvider>
      <StoppedPresetScene />
    </ToastProvider>,
  );
  await settle();
};

describe('the open questions of a paused preset run', () => {
  it.each([
    ['a step finishing its turn', 'running'],
    ['an agent stopped when Goodboy closed', 'stopped'],
  ] as const)('show on the run page with %s', async (_name, status) => {
    await mountPreset({ status });

    expect(clusters()).toHaveLength(1);
    within(clusters()[0]!).getByText('1 of 2');
    expect(document.querySelector('[aria-label="Run state"] [data-tail]')).not.toBeNull();
  });
});
