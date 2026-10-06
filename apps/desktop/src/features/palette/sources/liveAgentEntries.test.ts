// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId } from '@goodboy/types';
import { TEST_NOW, anAgent } from '@goodboy/types/testing';
import type { PaletteEntry } from '../types';
import { liveAgentVerbs, pickLiveAgent } from './liveAgentEntries';

const verb = (id: string, label: string): PaletteEntry => ({
  key: `verb:${id}`,
  label,
  kind: 'verb',
  group: 'action',
  icon: Inbox,
  action: { id } as PaletteEntry['action'],
  run: () => undefined,
});

describe('liveAgentVerbs', () => {
  it('names the agent in Message and Interrupt and keeps the old label findable', () => {
    const verbs = liveAgentVerbs({
      verbs: [
        verb('agent.message', 'Message this agent'),
        verb('agent.interrupt', 'Interrupt'),
        verb('agent.close', 'Close'),
      ],
      name: 'Implementer',
    });

    expect(verbs.map((entry) => entry.label)).toEqual([
      'Message Implementer',
      'Interrupt Implementer',
    ]);
    expect(verbs.map((entry) => entry.key)).toEqual([
      'verb:agent.message:live',
      'verb:agent.interrupt:live',
    ]);
    expect(verbs[0]?.secondary).toContain('Message this agent');
    expect(verbs.every((entry) => entry.isScopeVerb === true)).toBe(true);
  });
});

describe('pickLiveAgent', () => {
  const agent = (id: string, isDeleted = false) =>
    anAgent({ id: id as AgentId, name: id, ...(isDeleted ? { deletedAt: TEST_NOW } : {}) });

  it('takes the selected agent when it runs, else the first one that runs', () => {
    const agents = [agent('a'), agent('b'), agent('c')];
    const running = (candidate: Agent) => candidate.id !== 'a';

    expect(pickLiveAgent({ agents, selectedAgentId: 'c', isTurnRunning: running })?.id).toBe('c');
    expect(pickLiveAgent({ agents, selectedAgentId: 'a', isTurnRunning: running })?.id).toBe('b');
  });

  it('has none when nothing runs, and skips a deleted agent', () => {
    expect(
      pickLiveAgent({ agents: [agent('a')], selectedAgentId: null, isTurnRunning: () => false }),
    ).toBeNull();
    expect(
      pickLiveAgent({
        agents: [agent('a', true)],
        selectedAgentId: null,
        isTurnRunning: () => true,
      }),
    ).toBeNull();
  });
});
