// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, ProviderRunId, ResolveAttempt } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { FixRunLead } from './FixRunLead';

let useAppStore: StoryStore;

const AGENT_ID = 'agent-fix-lead' as AgentId;
const RUN_ID = 'run-fix-lead' as ProviderRunId;
const AT = '2026-09-04T14:01:00.000Z' as IsoDateTime;
const COVERED = [EXPANDED_THREAD_ID, THREAD_IDS.metrics, THREAD_IDS.typo] as const;

const ATTEMPT: ResolveAttempt = {
  id: 'attempt-fix-lead',
  sessionId: SESSION.id,
  agentId: AGENT_ID,
  prNumber: 318,
  threadIds: COVERED,
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase: 'running',
  mountTarget: null,
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
};

const AGENT: Agent = {
  id: AGENT_ID,
  sessionId: SESSION.id,
  ordinal: 1,
  name: 'resolve: comments',
  kind: 'resolver',
  status: 'running',
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = async (): Promise<void> => {
  seedResolveScene({ expandedThreadId: null });
  useAppStore.setState({
    sessionResolveAttempts: { [SESSION.id]: [ATTEMPT] },
    sessionPhaseRuns: { [SESSION.id]: [AGENT] },
    agentTurnState: {
      [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: AT },
    },
  });
  render(
    <div>
      <FixRunLead sessionId={SESSION.id} agentId={AGENT_ID} />
      <section aria-label="Transcript">
        <p>Reading the retry loop in payments-api.</p>
      </section>
    </div>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('the fix run lead', () => {
  it('shows the status and every comment the run covers, above the transcript', async () => {
    await mount();

    const lead = await screen.findByTestId('fix-run-lead');
    const transcript = screen.getByRole('region', { name: 'Transcript' });

    expect(within(lead).getByTestId('fix-run-status')).toBeDefined();
    expect(within(lead).getByRole('heading', { name: 'Covers 3 comments' })).toBeDefined();
    expect(within(within(lead).getByRole('list')).getAllByRole('button')).toHaveLength(3);
    expect(lead.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('keeps the transcript reachable beside the lead', async () => {
    await mount();

    await screen.findByTestId('fix-run-lead');

    expect(screen.getByText('Reading the retry loop in payments-api.')).toBeDefined();
  });
});
