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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aWorkflowRun } from '@goodboy/types/testing';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TurnEvent,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryAgent,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { NextActionStrip } from './index';

const SESSION_ID = 'session-harborline' as SessionId;
const WORKFLOW_ID = 'workflow-retry' as WorkflowId;
const RUN_ID = 'run-retry' as WorkflowRunId;
const REVIEWER = 'agent-reviewer' as AgentId;
const TESTER = 'agent-tester' as AgentId;
const TURN_RUN = 'provider-run-1' as ProviderRunId;
const STARTED_AT = '2026-10-03T09:00:00.000Z' as IsoDateTime;
const LAST_EVENT_AT = '2026-10-03T09:01:00.000Z' as IsoDateTime;
const MINUTE = 60_000;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: 'workspace-harborline' as WorkspaceId,
  name: 'Retry payments through ledger-core',
  description: '',
  steps: ['Review', 'Test'].map((name, ordinal) => ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  })),
  createdAt: STARTED_AT,
  updatedAt: STARTED_AT,
};

const run = aWorkflowRun({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  autoRun: true,
  executionMode: 'static',
});

const agents: ReadonlyArray<Agent> = [
  buildStoryAgent({
    id: REVIEWER,
    sessionId: SESSION_ID,
    stepId: 'step-0' as StepId,
    workflowRunId: RUN_ID,
    ordinal: 0,
    name: 'Reviewer',
    status: 'running',
  }),
  buildStoryAgent({
    id: TESTER,
    sessionId: SESSION_ID,
    stepId: 'step-1' as StepId,
    workflowRunId: RUN_ID,
    ordinal: 1,
    name: 'Tester',
    status: 'pending',
  }),
];

const readFile: TurnEvent = {
  kind: 'tool_call_start',
  runId: TURN_RUN,
  toolUseId: 'tool-1',
  toolName: 'read_file',
  input: { file_path: 'src/retry/backoff.ts' },
  at: LAST_EVENT_AT,
};

const readDone: TurnEvent = {
  kind: 'tool_call_end',
  runId: TURN_RUN,
  toolUseId: 'tool-1',
  output: 'ok',
  isError: false,
  at: LAST_EVENT_AT,
};

let useAppStore: StoryStore;
const askAgentToContinue = vi.fn(async () => undefined);
const skipStuckStepAndAdvance = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ shouldAdvanceTime: false });
  askAgentToContinue.mockClear();
  skipStuckStepAndAdvance.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seed = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }) => {
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: agents },
    agentTurnState: { [REVIEWER]: { kind: 'running', runId: TURN_RUN, startedAt: STARTED_AT } },
    transcripts: { [REVIEWER]: events },
    askAgentToContinue,
    skipStuckStepAndAdvance,
  });
};

const renderAt = ({ minutesAfterLastEvent }: { readonly minutesAfterLastEvent: number }) => {
  vi.setSystemTime(Date.parse(LAST_EVENT_AT) + minutesAfterLastEvent * MINUTE);
  return render(
    <NextActionStrip sessionId={SESSION_ID} run={run} workflow={workflow} subjectAgentId={null} />,
  );
};

describe('QuietStepStrip', () => {
  it('says nothing while the live step spoke in the last 15 minutes', () => {
    seed({ events: [readFile, readDone] });
    renderAt({ minutesAfterLastEvent: 14 });

    expect(screen.queryByTestId('quiet-step-strip')).toBeNull();
  });

  it('names the quiet time and the last event once the clock passes 15 minutes', () => {
    seed({ events: [readFile, readDone] });
    renderAt({ minutesAfterLastEvent: 14 });

    act(() => {
      vi.advanceTimersByTime(2 * MINUTE);
    });

    screen.getByText('No output for 16 min');
    screen.getByText(
      'Last event: read_file src/retry/backoff.ts. Reviewer may be stuck or waiting on a long call.',
    );
  });

  it('holds the warning while a tool call is still open, however long it takes', () => {
    seed({ events: [readFile] });
    renderAt({ minutesAfterLastEvent: 40 });

    expect(screen.queryByTestId('quiet-step-strip')).toBeNull();
  });

  it('asks the quiet agent to continue', () => {
    seed({ events: [readFile, readDone] });
    renderAt({ minutesAfterLastEvent: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Ask it to continue' }));

    expect(askAgentToContinue).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: REVIEWER });
  });

  it('skips only the quiet agent after the inline confirmation', () => {
    seed({ events: [readFile, readDone] });
    renderAt({ minutesAfterLastEvent: 20 });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    screen.getByText(
      'Its turn is cancelled and the step is marked Skipped. Its changes stay in the worktree. The run moves on to Tester.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip step' }));

    expect(skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      force: true,
      agentId: REVIEWER,
    });
  });
});
