import { describe, expect, it } from 'vitest';
import type { Agent, IsoDateTime } from '@goodboy/types';
import { isAgentSettled, isAgentStatusSettled } from './settled';

type MakeAgentParams = {
  readonly status: Agent['status'];
  readonly doneAt?: IsoDateTime;
};

const makeAgent = ({ status, doneAt }: MakeAgentParams): Agent => ({
  id: `agent-${status}` as Agent['id'],
  sessionId: 's1' as Agent['sessionId'],
  ordinal: 1,
  name: 'Implementer',
  status,
  ...(doneAt != null && { doneAt }),
});

const CLOSED_AT = '2026-09-24T10:00:00.000Z' as IsoDateTime;

describe('isAgentStatusSettled', () => {
  it.each([
    ['completed', true],
    ['skipped', true],
    ['failed', false],
    ['pending', false],
    ['running', false],
  ] as const)('treats %s as settled: %s', (status, expected) => {
    expect(isAgentStatusSettled({ status })).toBe(expected);
  });
});

describe('isAgentSettled', () => {
  it('follows the status when the user never closed the agent', () => {
    expect(isAgentSettled({ agent: makeAgent({ status: 'completed' }) })).toBe(true);
    expect(isAgentSettled({ agent: makeAgent({ status: 'failed' }) })).toBe(false);
    expect(isAgentSettled({ agent: makeAgent({ status: 'pending' }) })).toBe(false);
  });

  it('settles an agent the user closed, whatever its status', () => {
    expect(isAgentSettled({ agent: makeAgent({ status: 'failed', doneAt: CLOSED_AT }) })).toBe(
      true,
    );
    expect(isAgentSettled({ agent: makeAgent({ status: 'pending', doneAt: CLOSED_AT }) })).toBe(
      true,
    );
  });
});
