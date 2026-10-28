// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type Agent, type AgentId, type StepId, type TurnEvent } from '@goodboy/types';
import { TEST_NOW, aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { StepEndedNotice } from './index';

const RUN = aWorkflowRun();
const SESSION = aSession({ workflowRuns: [RUN] });
const AGENT_ID = brandId<AgentId>({ value: 'agent-scout-acme' });

let useAppStore: StoryStore;

type StoryState = ReturnType<StoryStore['getState']>;

const stepAgent = (overrides: Partial<Agent> = {}): Agent =>
  anAgent({
    id: AGENT_ID,
    sessionId: SESSION.id,
    name: 'Scout',
    workflowRunId: RUN.id,
    stepId: brandId<StepId>({ value: 'step-scout' }),
    status: 'blocked',
    ...overrides,
  });

const said = (text: string): TurnEvent => ({
  kind: 'assistant_text',
  runId: brandId<Extract<TurnEvent, { kind: 'done' }>['runId']>({ value: 'run-1' }),
  delta: text,
  at: TEST_NOW,
});

type SetupParams = {
  readonly agent?: Agent;
  readonly closing?: string;
};

const setup = ({
  agent = stepAgent(),
  closing = 'Traced the rounding to post_line.',
}: SetupParams = {}) => {
  const askAgentToContinue = vi.fn<StoryState['askAgentToContinue']>(async () => undefined);
  const markStepDone = vi.fn<StoryState['markStepDone']>(async () => undefined);
  useAppStore.setState({
    sessions: [SESSION],
    sessionPhaseRuns: { [SESSION.id]: [agent] },
    transcripts: { [AGENT_ID]: [said(closing)] },
    sessionArtifacts: {},
    agentKindOverride: {},
    askAgentToContinue,
    markStepDone,
  });
  return { askAgentToContinue, markStepDone };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('StepEndedNotice', () => {
  it('says the step ended without a result and offers Continue and Mark step done', () => {
    setup();
    render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    screen.getByText('This step ended without a result');
    screen.getByRole('button', { name: 'Continue' });
    screen.getByRole('button', { name: 'Mark step done' });
  });

  it('asks the same agent to continue', async () => {
    const { askAgentToContinue } = setup();
    render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(askAgentToContinue).toHaveBeenCalledWith({ sessionId: SESSION.id, agentId: AGENT_ID }),
    );
  });

  it('marks the step done once', async () => {
    const { markStepDone } = setup();
    render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark step done' }));

    await waitFor(() =>
      expect(markStepDone).toHaveBeenCalledWith({ sessionId: SESSION.id, agentId: AGENT_ID }),
    );
    expect(markStepDone).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the step asked the user something', () => {
    setup({ closing: 'Which export should I trace first, the nightly one or the manual one?' });
    const { container } = render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    expect(container.textContent).toBe('');
  });

  it('shows nothing for a step that is running, done or not part of a workflow', () => {
    for (const agent of [
      stepAgent({ status: 'running' }),
      stepAgent({ status: 'completed' }),
      stepAgent({ status: 'failed' }),
      anAgent({ id: AGENT_ID, sessionId: SESSION.id, status: 'blocked' }),
    ]) {
      setup({ agent });
      const { container, unmount } = render(
        <StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />,
      );
      expect(container.textContent).toBe('');
      unmount();
    }
  });
});
