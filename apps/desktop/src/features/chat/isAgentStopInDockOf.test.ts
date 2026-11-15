import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentStatus,
  type IsoDateTime,
  type ProviderRunId,
  type TurnState,
} from '@goodboy/types';
import { conversationStopOf } from './components/ConversationDock/conversationStopOf';
import { isAgentRunningOf } from './isAgentRunningOf';
import { isAgentStopInDockOf } from './isAgentStopInDockOf';

const RUN_ID = brandId<ProviderRunId>({ value: 'mock-run-1' });
const AT = brandId<IsoDateTime>({ value: '2026-10-13T12:00:00.000Z' });

const TURNS: ReadonlyArray<TurnState | null> = [
  null,
  { kind: 'idle', lastActivityAt: AT },
  { kind: 'starting', startedAt: AT },
  { kind: 'running', runId: RUN_ID, startedAt: AT },
  { kind: 'blocked', runId: RUN_ID, blockedAt: AT },
  { kind: 'error', message: 'provider exited', failedAt: AT },
];

const STATUSES: ReadonlyArray<AgentStatus> = [
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'stopped',
];

const CASES = TURNS.flatMap((turn) => STATUSES.map((status) => ({ turn, status })));

describe('isAgentStopInDockOf', () => {
  it.each(CASES)('agrees with the dock Stop for turn $turn.kind and $status', (row) => {
    const { turn, status } = row;
    const stop = conversationStopOf({
      agentStop: {
        phase: 'idle',
        isLive: turn?.kind === 'running' || turn?.kind === 'blocked',
        isBlocked: turn?.kind === 'blocked',
        stop: () => undefined,
      },
      scoped: null,
      stopLabel: null,
      isRunning: isAgentRunningOf({ turn, status }),
      sentence: null,
      hasOpenAsk: false,
      isStoppedAnswer: false,
    });

    expect(isAgentStopInDockOf({ turn, status })).toBe(stop !== null);
  });
});
