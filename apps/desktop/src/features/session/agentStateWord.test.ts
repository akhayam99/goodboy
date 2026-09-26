import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, AgentStatus } from '@goodboy/types';
import { agentStateWord } from './agentStateWord';
import { isAgentFinished } from './agent-lifecycle';

const STATUSES: ReadonlyArray<AgentStatus> = [
  'pending',
  'running',
  'completed',
  'failed',
  'blocked',
  'skipped',
  'stopped',
];

const agentWith = (status: AgentStatus, doneAt?: string): Agent =>
  ({
    id: 'agent-1' as AgentId,
    name: 'Explain the 409',
    ordinal: 0,
    status,
    ...(doneAt !== undefined && { doneAt }),
  }) as Agent;

describe('agentStateWord', () => {
  it('never puts a word in a group that contradicts isAgentFinished', () => {
    for (const status of STATUSES) {
      for (const doneAt of [undefined, '2026-09-26T10:00:00.000Z']) {
        for (const hasOpenQuestion of [false, true]) {
          for (const isTurnLive of [false, true]) {
            const params = {
              agent: agentWith(status, doneAt),
              hasOpenQuestion,
              isTurnLive,
              hasActiveChild: false,
            };
            const word = agentStateWord(params);
            expect(word.group === 'done').toBe(isAgentFinished(params));
            expect(word.word).not.toBe(status);
          }
        }
      }
    }
  });

  it('says Needs you for an open question on a finished turn', () => {
    const word = agentStateWord({
      agent: agentWith('completed'),
      hasOpenQuestion: true,
      isTurnLive: false,
      hasActiveChild: false,
    });
    expect(word).toMatchObject({ word: 'Needs you', group: 'needs-you' });
  });

  it('keeps a completed agent with a live child running', () => {
    const word = agentStateWord({
      agent: agentWith('completed'),
      hasOpenQuestion: false,
      isTurnLive: false,
      hasActiveChild: true,
    });
    expect(word).toMatchObject({ word: 'Running', group: 'running' });
  });
});
