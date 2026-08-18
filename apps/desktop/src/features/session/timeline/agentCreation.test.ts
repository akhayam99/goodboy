import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { resolveAgentCreation } from './agentCreation';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

type AgentParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
};

const agent = ({ id, ordinal, startedAt, completedAt }: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: typedString<SessionId>({ value: 'session-1' }),
  ordinal,
  name: id,
  status: 'completed',
  ...(startedAt != null ? { startedAt: typedString<IsoDateTime>({ value: startedAt }) } : {}),
  ...(completedAt != null ? { completedAt: typedString<IsoDateTime>({ value: completedAt }) } : {}),
});

describe('resolveAgentCreation', () => {
  it('reads the earliest recorded instant, so a NULL started_at falls back to completed_at', () => {
    const creations = resolveAgentCreation({
      agents: [agent({ id: 'one', ordinal: 1, completedAt: '2026-08-17T10:00:00Z' })],
    });

    expect(creations.get('one')?.at).toBe('2026-08-17T10:00:00Z');
    expect(creations.get('one')?.isRecorded).toBe(true);
  });

  it('clamps a restarted agent below the agent created after it', () => {
    const creations = resolveAgentCreation({
      agents: [
        agent({ id: 'older', ordinal: 1, startedAt: '2026-08-17T15:00:00Z' }),
        agent({ id: 'newer', ordinal: 2, startedAt: '2026-08-17T11:00:00Z' }),
      ],
    });

    expect(creations.get('newer')?.at).toBe('2026-08-17T11:00:00Z');
    expect(creations.get('older')?.at).toBe('2026-08-17T11:00:00Z');
  });

  it('gives a never-started agent the instant of the next newer agent', () => {
    const creations = resolveAgentCreation({
      agents: [
        agent({ id: 'pending', ordinal: 1 }),
        agent({ id: 'started', ordinal: 2, startedAt: '2026-08-17T11:00:00Z' }),
      ],
    });

    expect(creations.get('pending')?.at).toBe('2026-08-17T11:00:00Z');
    expect(creations.get('pending')?.isRecorded).toBe(false);
  });

  it('leaves the newest never-started agent without an instant', () => {
    const creations = resolveAgentCreation({
      agents: [
        agent({ id: 'started', ordinal: 1, startedAt: '2026-08-17T11:00:00Z' }),
        agent({ id: 'pending', ordinal: 2 }),
      ],
    });

    expect(creations.get('pending')?.at).toBeNull();
    expect(creations.get('started')?.at).toBe('2026-08-17T11:00:00Z');
  });
});
