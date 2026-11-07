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
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type StepId,
  type TurnEvent,
} from '@goodboy/types';
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

const ENDED_AT = brandId<IsoDateTime>({ value: '2026-10-18T09:30:00.000Z' });

type SetupParams = {
  readonly agent?: Agent;
  readonly closing?: string;
  readonly silentEndMark?: string;
};

const setup = ({
  agent = stepAgent({ completedAt: ENDED_AT }),
  closing = 'Traced the rounding to post_line.',
  silentEndMark = ENDED_AT,
}: SetupParams = {}) => {
  const markStepDone = vi.fn<StoryState['markStepDone']>(async () => undefined);
  useAppStore.setState({
    sessions: [SESSION],
    sessionPhaseRuns: { [SESSION.id]: [agent] },
    transcripts: { [AGENT_ID]: [said(closing)] },
    sessionArtifacts: {},
    agentKindOverride: {},
    silentlyEndedSteps: { [AGENT_ID]: silentEndMark },
    markStepDone,
  });
  return { markStepDone };
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('StepEndedNotice', () => {
  it('says the step ended without a result and offers Mark step done', () => {
    setup();
    render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    screen.getByText('This step ended without a result');
    screen.getByRole('button', { name: 'Mark step done' });
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
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

  it('names the failure of Mark step done, keeps the notice and lets the same button try again', async () => {
    const { markStepDone } = setup();
    const reportError = vi.fn<StoryState['reportError']>(async () => undefined);
    useAppStore.setState({ reportError });
    markStepDone.mockRejectedValueOnce(new Error('The step is no longer waiting.'));
    render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mark step done' }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't mark the step done", sessionId: SESSION.id }),
      ),
    );
    screen.getByText('This step ended without a result');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mark step done' }).hasAttribute('disabled')).toBe(
        false,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark step done' }));

    await waitFor(() => expect(markStepDone).toHaveBeenCalledTimes(2));
  });

  it('shows nothing for a block the silent end watch did not record, so the real reason stays', () => {
    setup({ silentEndMark: '2026-10-18T08:00:00.000Z' });
    const { container } = render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);
    expect(container.textContent).toBe('');
    cleanup();

    useAppStore.setState({ silentlyEndedSteps: {} });
    const none = render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);
    expect(none.container.textContent).toBe('');
  });

  it('shows nothing when the step asked the user something', () => {
    setup({ closing: 'Which export should I trace first, the nightly one or the manual one?' });
    const { container } = render(<StepEndedNotice sessionId={SESSION.id} agentId={AGENT_ID} />);

    expect(container.textContent).toBe('');
  });

  it('shows nothing for a step that is running, done or not part of a workflow', () => {
    for (const agent of [
      stepAgent({ status: 'running', completedAt: ENDED_AT }),
      stepAgent({ status: 'completed', completedAt: ENDED_AT }),
      stepAgent({ status: 'failed', completedAt: ENDED_AT }),
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
