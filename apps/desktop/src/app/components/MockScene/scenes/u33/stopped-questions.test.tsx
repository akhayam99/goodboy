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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { BLOCKED_MOUNT_SESSION_ID } from '../u30/blockedMountStepSeed';
import { U33_STOPPED_QUESTIONS_SCENES } from './stopped-questions';
import { STOPPED_FIRST_QUESTION_ID } from './stoppedQuestionsSeed';

const SCENE = 'u33-run-stopped-questions';
const SETTLE_MS = 2_000;

const pendingInvoke = () => new Promise<never>(() => undefined);

type StopCase = {
  readonly name: string;
  readonly stop: WorkflowOrchestrationStop;
  readonly phrase: string;
  readonly hint: string;
  readonly action: string | null;
};

const STOP_CASES: ReadonlyArray<StopCase> = [
  {
    name: 'budget',
    stop: { kind: 'budget', message: 'Paused at the $5 limit for this session.' },
    phrase: 'Paused at the $5 limit for this session.',
    hint: 'Raise the limit to answer',
    action: 'Raise limit',
  },
  {
    name: 'failure',
    stop: { kind: 'failure', message: 'the orchestrator reply could not be parsed' },
    phrase: 'Last decision failed: the orchestrator reply could not be parsed',
    hint: 'Retry the run to answer',
    action: 'Retry',
  },
  {
    name: 'operator',
    stop: { kind: 'operator', message: 'Stopped from the run page' },
    phrase: 'Stopped by you · the step in flight was skipped',
    hint: 'Continue the run to answer',
    action: 'Continue the run',
  },
  {
    name: 'needs-approval',
    stop: { kind: 'needs-approval', message: 'Deploy to Cascadia needs a go' },
    phrase: 'Paused · needs your approval',
    hint: 'Approve to answer',
    action: null,
  },
  {
    name: 'paused',
    stop: { kind: 'paused', message: 'Paused from the run page' },
    phrase: 'Paused by you',
    hint: 'Resume the run to answer',
    action: 'Resume',
  },
  {
    name: 'preset-change',
    stop: { kind: 'preset-change', message: 'The preset changed under the run' },
    phrase: 'Paused · the preset needs your call',
    hint: 'Decide on the preset to answer',
    action: null,
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
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
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
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  if (stop === undefined) {
    return;
  }
  await setStop({ stop });
};

const clusters = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-run-open-question]'));

const hintRow = (): HTMLElement => {
  const row = document.querySelector<HTMLElement>('[data-run-questions-hint]');
  if (row === null) {
    throw new Error('the questions show no hint');
  }
  return row;
};

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

type DisabledParams = {
  readonly node: HTMLElement;
};

const isDisabled = ({ node }: DisabledParams): boolean =>
  (node instanceof HTMLButtonElement && node.disabled) ||
  node.getAttribute('aria-disabled') === 'true';

const stubAnswerStore = () => {
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
  return sendTurn;
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

  it.each(STOP_CASES)('shows the $name stop and the open questions once', async (stopCase) => {
    await mount({ stop: stopCase.stop });

    expect(clusters()).toHaveLength(1);
    const cluster = clusters()[0]!;
    expect(cluster.dataset.runOpenQuestion).toBe(STOPPED_FIRST_QUESTION_ID);
    within(cluster).getByText('1 of 2');
    within(tailLine()).getByText(stopCase.phrase);
  });

  it.each(STOP_CASES)(
    'reads the $name stop as read only: Answer is disabled and the stop action is reachable',
    async (stopCase) => {
      await mount({ stop: stopCase.stop });
      const cluster = clusters()[0]!;

      expect(isDisabled({ node: within(cluster).getByRole('button', { name: 'Answer' }) })).toBe(
        true,
      );
      within(cluster)
        .getAllByRole('radio')
        .forEach((option) => expect(isDisabled({ node: option })).toBe(true));
      const sendAsMessage = within(cluster).queryByRole('button', { name: 'Send as message' });
      expect(sendAsMessage === null || isDisabled({ node: sendAsMessage })).toBe(true);
      const delegate = within(cluster).queryByTestId('delegate-answer-row');
      expect(delegate === null || isDisabled({ node: delegate })).toBe(true);

      const row = hintRow();
      expect(cluster.contains(row)).toBe(true);
      within(row).getByText(stopCase.hint);
      if (stopCase.action === null) {
        expect(within(row).queryAllByRole('button')).toHaveLength(0);
        return;
      }
      expect(isDisabled({ node: within(row).getByRole('button', { name: stopCase.action }) })).toBe(
        false,
      );
    },
  );

  it.each(STOP_CASES)('ignores the keys 1 to 4 and Enter on the $name stop', async (stopCase) => {
    await mount({ stop: stopCase.stop });
    const sendTurn = stubAnswerStore();
    const card = within(clusters()[0]!).getByRole('article');
    act(() => {
      useOpenQuestions
        .getState()
        .toggleSuggestion(
          brandId<OpenQuestionId>({ value: STOPPED_FIRST_QUESTION_ID }),
          'Batch them',
          'one',
        );
    });

    for (const key of ['1', '2', '3', '4', 'Enter']) {
      await act(async () => {
        fireEvent.keyDown(card, { key });
      });
    }

    expect(sendTurn).not.toHaveBeenCalled();
    expect(useOpenQuestions.getState().staged).toEqual([]);
    expect(within(card).getByRole('button', { name: 'Answer' })).toHaveProperty('disabled', true);
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
    'makes the questions answerable once the $name stop clears, and the answers send once',
    async (stopCase) => {
      await mount({ stop: stopCase.stop });
      const sendTurn = stubAnswerStore();

      await setStop({ stop: undefined });
      const block = clusters()[0]!;

      expect(document.querySelector('[data-run-questions-hint]')).toBeNull();
      await click({ node: within(block).getByRole('radio', { name: 'Batch them' }) });
      await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
      await click({ node: within(block).getByRole('radio', { name: '500 rows' }) });
      await click({ node: within(block).getByRole('button', { name: 'Answer' }) });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SETTLE_MS);
      });

      expect(sendTurn).toHaveBeenCalledTimes(1);
      expect(clusters()).toHaveLength(0);
    },
  );

  it('keeps the typed answer and the questions when storing the answers fails after resume', async () => {
    await mount({ stop: STOP_CASES[0]!.stop });
    await setStop({ stop: undefined });
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
