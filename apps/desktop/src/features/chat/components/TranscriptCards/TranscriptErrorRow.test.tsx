// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { TranscriptErrorRow } from './TranscriptErrorRow';

const NOW_MS = Date.UTC(2026, 9, 23, 12, 0, 0);
const RESET_MS = NOW_MS + 6 * 60 * 60 * 1000;
const RUN = brandId<ProviderRunId>({ value: 'run-harborline-1' });
const SESSION = brandId<SessionId>({ value: 'session-harborline-1' });
const AGENT = brandId<AgentId>({ value: 'agent-harborline-1' });
const MESSAGE = "You've hit your usage limit. Try again at 18:40.";
const AT = formatClock({ at: RESET_MS });

const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ now: NOW_MS });
  sendTurn.mockClear();
  useAppStore.setState({ sendTurn, limitStops: {} });
});

afterEach(() => {
  useAppStore.getState().clearAgentLimitStops({ agentId: AGENT });
  cleanup();
  vi.useRealTimers();
});

const seedStop = () =>
  useAppStore.getState().recordLimitStop({
    stop: {
      runId: RUN,
      agentId: AGENT,
      sessionId: SESSION,
      provider: 'anthropic',
      resetAtMs: RESET_MS,
      isScheduled: false,
      input: { sessionId: SESSION, agentId: AGENT, content: 'finish the export' },
    },
  });

describe('the limit panel in a stopped turn', () => {
  it('offers no continue button when no limit stop was recorded for the run', () => {
    render(<TranscriptErrorRow message={MESSAGE} runId={RUN} onRetry={() => undefined} />);

    expect(screen.queryByRole('button', { name: /^Continue at/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeNull();
  });

  it('offers the button with the reset time and starts nothing by itself', async () => {
    seedStop();
    render(<TranscriptErrorRow message={MESSAGE} runId={RUN} />);

    expect(screen.queryByRole('button', { name: `Continue at ${AT}` })).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 60_000);
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('schedules on the click, says when, and continues at the reset time', async () => {
    seedStop();
    render(<TranscriptErrorRow message={MESSAGE} runId={RUN} />);

    fireEvent.click(screen.getByRole('button', { name: `Continue at ${AT}` }));

    expect(screen.queryByText(`Continues at ${AT} if Goodboy stays open`)).not.toBeNull();
    expect(screen.queryByRole('button', { name: `Continue at ${AT}` })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);
    });
    expect(sendTurn).toHaveBeenCalledOnce();
  });

  it('cancels a scheduled continue and offers the button again', async () => {
    seedStop();
    render(<TranscriptErrorRow message={MESSAGE} runId={RUN} />);
    fireEvent.click(screen.getByRole('button', { name: `Continue at ${AT}` }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: `Continue at ${AT}` })).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 60_000);
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('keeps the plain Retry next to the continue button', () => {
    seedStop();
    render(<TranscriptErrorRow message={MESSAGE} runId={RUN} onRetry={() => undefined} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: `Continue at ${AT}` })).not.toBeNull();
  });
});

describe('View transcript on a failed turn', () => {
  beforeEach(() => {
    useAppStore.setState({ currentSessionId: SESSION, drawer: null });
  });

  afterEach(() => {
    useAppStore.setState({ drawer: null });
  });

  it('sits next to Retry and opens the transcript drawer for that agent', () => {
    render(
      <TranscriptErrorRow
        message="The provider closed the connection."
        runId={RUN}
        sessionId={SESSION}
        agentId={AGENT}
        onRetry={() => undefined}
      />,
    );

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual(['Retry', 'View transcript']);
    fireEvent.click(screen.getByRole('button', { name: 'View transcript' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'transcript',
      sessionId: SESSION,
      payload: { agentId: AGENT },
    });
  });

  it('anchors the drawer to the failing call when it is known', () => {
    render(
      <TranscriptErrorRow
        message="The provider closed the connection."
        runId={RUN}
        sessionId={SESSION}
        agentId={AGENT}
        failedToolUseId="toolu-harborline-3"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View transcript' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'transcript',
      sessionId: SESSION,
      payload: { agentId: AGENT, toolUseId: 'toolu-harborline-3' },
    });
  });

  it('is offered without Retry when the turn cannot be retried', () => {
    render(
      <TranscriptErrorRow
        message="The provider closed the connection."
        sessionId={SESSION}
        agentId={AGENT}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View transcript' })).not.toBeNull();
  });

  it('is not offered where the agent is unknown', () => {
    render(<TranscriptErrorRow message="The provider closed the connection." runId={RUN} />);

    expect(screen.queryByRole('button', { name: 'View transcript' })).toBeNull();
  });

  it('is not offered inside the transcript drawer of the same agent', () => {
    useAppStore.setState({
      drawer: { kind: 'transcript', sessionId: SESSION, payload: { agentId: AGENT } },
    });
    render(
      <TranscriptErrorRow
        message="The provider closed the connection."
        sessionId={SESSION}
        agentId={AGENT}
      />,
    );

    expect(screen.queryByRole('button', { name: 'View transcript' })).toBeNull();
  });
});
