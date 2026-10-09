// @vitest-environment node
import { Inbox } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { Agent, AgentId } from '@goodboy/types';
import { TEST_NOW, anAgent } from '@goodboy/types/testing';
import type { PaletteEntry } from '../types';
import { liveAgentVerbs, pickLiveAgent, sessionOwnFirst } from './liveAgentEntries';

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

describe('sessionOwnFirst', () => {
  const row = (item: PaletteEntry) => ({ item, positions: [] as ReadonlyArray<number> });
  const sessionVerbs = [verb('session.diff', 'Review changes'), verb('session.review', 'Review')];
  const live = liveAgentVerbs({
    verbs: [verb('agent.message', 'Message this agent'), verb('agent.interrupt', 'Interrupt')],
    name: 'Implementer',
  });
  const sections = [
    { title: 'For this session', rows: [...live, ...sessionVerbs].map(row) },
    { title: 'Go to', rows: [row(verb('goto.board', 'Board'))] },
  ];
  const labelsOf = (
    result: ReadonlyArray<{ readonly rows: ReadonlyArray<{ item: PaletteEntry }> }>,
  ) => result.flatMap((section) => section.rows.map((entry) => entry.item.label));

  it('puts the session own verb first and keeps the agent verbs right behind it', () => {
    const result = sessionOwnFirst({ scopeKind: 'session', isIdle: true, sections });

    expect(labelsOf(result).slice(0, 4)).toEqual([
      'Review changes',
      'Message Implementer',
      'Interrupt Implementer',
      'Review',
    ]);
  });

  it.each(['workspace', 'agent', 'workflowRun', 'pullRequest', 'commit', null] as const)(
    'leaves a %s scope as it was',
    (scopeKind) => {
      expect(sessionOwnFirst({ scopeKind, isIdle: true, sections })).toBe(sections);
    },
  );

  it('leaves a typed query to its ranking', () => {
    expect(sessionOwnFirst({ scopeKind: 'session', isIdle: false, sections })).toBe(sections);
  });

  it('changes nothing when no agent verb leads', () => {
    const plain = [{ title: 'For this session', rows: sessionVerbs.map(row) }];

    expect(sessionOwnFirst({ scopeKind: 'session', isIdle: true, sections: plain })).toEqual(plain);
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
