import { describe, expect, it } from 'vitest';
import type { WorkflowLibraryStep } from '@goodboy/core';
import type { Agent, AgentId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  AGENT_KIND_PALETTE,
  type AgentKind,
  agentHomeLens,
  classifyAgent,
  inferAgentKindFromName,
  inferAgentKindFromStep,
  kindConsumesPlan,
  resolveAgentKind,
} from './agent-kind';

const agentOf = (over: Partial<Agent> = {}): Agent => ({
  id: 'a1' as AgentId,
  sessionId: 'sess-1' as SessionId,
  ordinal: 0,
  name: 'agent',
  status: 'pending',
  ...over,
});

const WF = 'wf-1' as WorkflowRunId;
const STEP = 'step-1' as StepId;

const ALL_KINDS: ReadonlyArray<AgentKind> = [
  'scout',
  'planner',
  'implementer',
  'debugger',
  'tester',
  'reviewer',
  'docs',
  'resolver',
  'generic',
];

function makeStep(role: string, name = role): WorkflowLibraryStep {
  return { name, role, promptPrefix: '', expectedOutput: '' };
}

describe('agentHomeLens', () => {
  it('routes a full workflow step agent (workflowRunId + stepId) to workflows', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF, stepId: STEP }), 'implementer')).toBe(
      'workflows',
    );
  });

  it('routes a cluster child (workflowRunId, no stepId) to workflows', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF }), 'implementer')).toBe('workflows');
  });

  it('routes a scout sub-agent (workflowRunId propagated, no stepId) to workflows', () => {
    expect(
      agentHomeLens(agentOf({ workflowRunId: WF, parentAgentId: 'p1' as AgentId }), 'scout'),
    ).toBe('workflows');
  });

  it('workflowRunId wins over resolver kind', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF }), 'resolver')).toBe('workflows');
  });

  it('routes a resolver with no workflowRunId to resolve', () => {
    expect(agentHomeLens(agentOf({}), 'resolver')).toBe('resolve');
  });

  it('routes a hand-spawned agent (no workflowRunId, non-resolver) to agents', () => {
    expect(agentHomeLens(agentOf({}), 'generic')).toBe('agents');
    expect(agentHomeLens(agentOf({}), 'scout')).toBe('agents');
  });

  it('does not route to workflows on stepId alone when workflowRunId is absent', () => {
    expect(agentHomeLens(agentOf({ stepId: STEP }), 'generic')).toBe('agents');
    expect(agentHomeLens(agentOf({ stepId: STEP }), 'resolver')).toBe('resolve');
  });
});

describe('AGENT_KIND_PALETTE', () => {
  it('has an entry for every AgentKind', () => {
    for (const kind of ALL_KINDS) {
      expect(AGENT_KIND_PALETTE[kind]).toBeDefined();
    }
  });

  it('every entry has bg, fg, and label', () => {
    for (const kind of ALL_KINDS) {
      const entry = AGENT_KIND_PALETTE[kind];
      expect(typeof entry.bg).toBe('string');
      expect(entry.bg.length).toBeGreaterThan(0);
      expect(typeof entry.fg).toBe('string');
      expect(entry.fg.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe('AGENT_KIND_DEFAULTS', () => {
  it('has an entry for every AgentKind', () => {
    for (const kind of ALL_KINDS) {
      expect(AGENT_KIND_DEFAULTS[kind]).toBeDefined();
    }
  });

  it('scout / docs / generic → haiku, low effort', () => {
    for (const kind of ['scout', 'docs', 'generic'] as AgentKind[]) {
      expect(AGENT_KIND_DEFAULTS[kind].effort).toBe('low');
      expect(AGENT_KIND_DEFAULTS[kind].model).toMatch(/haiku/i);
    }
  });

  it('implementer / debugger / reviewer / tester / resolver → sonnet, medium effort', () => {
    for (const kind of [
      'implementer',
      'debugger',
      'reviewer',
      'tester',
      'resolver',
    ] as AgentKind[]) {
      expect(AGENT_KIND_DEFAULTS[kind].effort).toBe('medium');
      expect(AGENT_KIND_DEFAULTS[kind].model).toMatch(/sonnet/i);
    }
  });

  it('resolver is hidden from the manual spawn menu', () => {
    expect(AGENT_KIND_DEFAULTS.resolver.visible).toBe(false);
  });

  it('only resolver is marked hidden today', () => {
    const allKinds: ReadonlyArray<AgentKind> = [
      'scout',
      'planner',
      'implementer',
      'debugger',
      'tester',
      'reviewer',
      'docs',
      'generic',
    ];
    for (const kind of allKinds) {
      expect(AGENT_KIND_DEFAULTS[kind].visible).not.toBe(false);
    }
  });

  it('planner → opus, high effort', () => {
    expect(AGENT_KIND_DEFAULTS['planner'].effort).toBe('high');
    expect(AGENT_KIND_DEFAULTS['planner'].model).toMatch(/opus/i);
  });
});

describe('inferAgentKindFromStep', () => {
  it.each([
    ['scout', 'scout'],
    ['explorer', 'scout'],
    ['investigator', 'debugger'],
    ['planner', 'planner'],
    ['architect', 'planner'],
    ['product', 'planner'],
    ['implementer', 'implementer'],
    ['tester', 'tester'],
    ['reviewer', 'reviewer'],
    ['docs', 'docs'],
    ['writer', 'docs'],
  ] as [string, AgentKind][])('role %s → %s', (role, expected) => {
    expect(inferAgentKindFromStep(makeStep(role))).toBe(expected);
  });

  it('unknown role falls back to generic', () => {
    expect(inferAgentKindFromStep(makeStep('oracle'))).toBe('generic');
  });
});

describe('resolveAgentKind', () => {
  it('override wins over everything', () => {
    expect(resolveAgentKind('Plan the migration', 'find the bug', 'docs')).toBe('docs');
  });

  it('override wins even when name contains role-triggering keywords', () => {
    expect(resolveAgentKind('fix login bug', null, 'generic')).toBe('generic');
    expect(resolveAgentKind('refactor auth module', null, 'scout')).toBe('scout');
  });

  it('prefers name-based inference when the name is meaningful', () => {
    expect(resolveAgentKind('Plan the migration', 'find the bug')).toBe('planner');
    expect(resolveAgentKind('Review diff', 'implement the feature')).toBe('reviewer');
  });

  it('falls back to first-turn classification when the name is generic', () => {
    expect(resolveAgentKind('agent 1', 'find where AgentKind is defined')).toBe('scout');
    expect(resolveAgentKind('agent 2', 'plan the migration')).toBe('planner');
    expect(resolveAgentKind('agent 3', 'implement the chip auto-label')).toBe('implementer');
    expect(resolveAgentKind('agent 4', 'audit the diff')).toBe('reviewer');
    expect(resolveAgentKind('agent 5', 'write a test for the parser')).toBe('tester');
    expect(resolveAgentKind('agent 6', 'update the readme')).toBe('docs');
    expect(resolveAgentKind('agent 7', 'debug the startup crash')).toBe('debugger');
  });

  it('stays generic when first turn is missing or unclassifiable', () => {
    expect(resolveAgentKind('agent 1', null)).toBe('generic');
    expect(resolveAgentKind('agent 1', '')).toBe('generic');
    expect(resolveAgentKind('agent 1', 'hello')).toBe('generic');
  });
});

describe('classifyAgent', () => {
  it('prefers an override over persisted kind and name inference', () => {
    expect(classifyAgent(agentOf({ name: 'plan migration', kind: 'scout' }), 'docs')).toBe('docs');
  });

  it('prefers a valid persisted kind over name inference', () => {
    expect(classifyAgent(agentOf({ name: 'plan migration', kind: 'reviewer' }), null)).toBe(
      'reviewer',
    );
  });

  it('falls back to name inference for an invalid persisted kind', () => {
    expect(classifyAgent(agentOf({ name: 'debug startup', kind: 'unknown' }), null)).toBe(
      'debugger',
    );
  });

  it('returns generic without a persisted kind or meaningful name', () => {
    expect(classifyAgent(agentOf({ name: 'agent 1' }), null)).toBe('generic');
  });
});

describe('inferAgentKindFromName', () => {
  it.each([
    ['Scout', 'scout'],
    ['Explore', 'scout'],
    ['Plan the approach', 'planner'],
    ['Spec', 'planner'],
    ['Design', 'planner'],
    ['Implement feature', 'implementer'],
    ['Refactor', 'implementer'],
    ['Debug crash', 'debugger'],
    ['Diagnose', 'debugger'],
    ['Fix', 'debugger'],
    ['Reproduce', 'debugger'],
    ['Review diff', 'reviewer'],
    ['Verify', 'reviewer'],
    ['Test', 'tester'],
    ['Write docs', 'docs'],
    ['resolve: alice on foo.ts:42', 'resolver'],
    ['Resolver', 'resolver'],
    ['agent 1', 'generic'],
  ] as [string, AgentKind][])('name %s → %s', (name, expected) => {
    expect(inferAgentKindFromName(name)).toBe(expected);
  });
});

describe('kindConsumesPlan', () => {
  const CONSUMING: ReadonlyArray<AgentKind> = ['implementer', 'debugger', 'generic'];

  it.each(ALL_KINDS)('%s partitions into consumer vs passthrough', (kind) => {
    expect(kindConsumesPlan(kind)).toBe(CONSUMING.includes(kind));
  });

  it('keeps read/test/doc roles as passthrough', () => {
    for (const kind of ['scout', 'reviewer', 'tester', 'docs', 'planner', 'resolver'] as const) {
      expect(kindConsumesPlan(kind)).toBe(false);
    }
  });
});

describe('AGENT_KIND_META', () => {
  it('has an entry for every AgentKind', () => {
    for (const kind of ALL_KINDS) {
      expect(AGENT_KIND_META[kind]).toBeDefined();
      expect(typeof AGENT_KIND_META[kind].label).toBe('string');
      expect(AGENT_KIND_META[kind].label.length).toBeGreaterThan(0);
      expect(typeof AGENT_KIND_META[kind].hint).toBe('string');
      expect(AGENT_KIND_META[kind].hint.length).toBeGreaterThan(0);
    }
  });
});

describe('boundary systemPrompts', () => {
  it('all kinds have a systemPrompt', () => {
    for (const kind of ALL_KINDS) {
      expect(AGENT_KIND_DEFAULTS[kind].systemPrompt).toBeDefined();
      expect(typeof AGENT_KIND_DEFAULTS[kind].systemPrompt).toBe('string');
      expect(AGENT_KIND_DEFAULTS[kind].systemPrompt!.length).toBeGreaterThan(0);
    }
  });

  it('non-generic prompts contain FORBIDDEN', () => {
    for (const kind of ALL_KINDS) {
      if (kind === 'generic') {
        continue;
      }
      expect(AGENT_KIND_DEFAULTS[kind].systemPrompt).toContain('FORBIDDEN');
    }
  });

  it('generic prompt has no restrictions', () => {
    expect(AGENT_KIND_DEFAULTS['generic'].systemPrompt).toContain('no role restrictions');
  });
});
