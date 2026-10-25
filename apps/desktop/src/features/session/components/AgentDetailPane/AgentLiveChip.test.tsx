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
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { stopRequests } from '../../../../store/slices/turn/stopRequests';
import { AgentLiveChip } from './AgentLiveChip';

const AGENT_ID = brandId<AgentId>({ value: 'agent-implementer' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const agent = anAgent({ id: AGENT_ID, name: 'Implementer', status: 'running' });
const cancelMock = vi.fn(async () => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-24T09:04:12.000Z'));
  cancelMock.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({
    agentTurnState: {
      [AGENT_ID]: {
        kind: 'running',
        runId: RUN_ID,
        startedAt: brandId<IsoDateTime>({ value: '2026-10-24T09:00:00.000Z' }),
      },
    },
    cancelCurrentTurn: cancelMock,
  });
});

afterEach(() => {
  stopRequests.settle({ agentId: AGENT_ID });
  cleanup();
  vi.useRealTimers();
});

describe('AgentLiveChip', () => {
  it('reads Running with the clock and a Stop that stops this agent', () => {
    render(<AgentLiveChip sessionId={agent.sessionId} agent={agent} />);

    screen.getByText('Running');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(cancelMock).toHaveBeenCalledWith(agent.sessionId, AGENT_ID, 'user');
  });

  it('shows nothing once the turn is not running', () => {
    useAppStore.setState({ agentTurnState: {} });

    const { container } = render(<AgentLiveChip sessionId={agent.sessionId} agent={agent} />);

    expect(container.querySelector('[data-agent-live]')).toBeNull();
  });

  it('reads Stopping while the process exits and Still stopping with Force stop after 5 s', () => {
    render(<AgentLiveChip sessionId={agent.sessionId} agent={agent} />);

    act(() => stopRequests.request({ agentId: AGENT_ID, runId: RUN_ID, at: Date.now() }));
    screen.getByText('Stopping', { selector: 'span' });
    expect(screen.getByRole('button', { name: /Stopping/ }).hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5_100);
    });
    screen.getByText('Still stopping');
    fireEvent.click(screen.getByRole('button', { name: 'Force stop' }));
    expect(cancelMock).toHaveBeenCalledOnce();
  });
});
