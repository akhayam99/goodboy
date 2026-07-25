import { describe, expect, it } from 'vitest';
import { PROVIDER_CAPABILITIES, ROLE_DEFAULTS, type WorkflowLibraryStep } from '@goodboy/core';
import type { Agent, AgentId, SessionId, StepId, WorkflowRunId } from '@goodboy/types';
import { EFFORT_LEVELS } from '../chat/utils/chat-constants';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  AGENT_KIND_PALETTE,
  type AgentKind,
  agentHomeLens,
  classifyAgent,
  inferAgentKindFromName,
  inferAgentKindFromStep,
  isStandaloneAgent,
  kindConsumesPlan,
  kindRouting,
  resolveAgentKind,
  resolveRootAgent,
  selectNonResolverStandaloneAgents,
  selectStandaloneAgents,
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
  'pr-reviewer',
  'docs',
  'resolver',
  'generic',
];

function makeStep(role: string, name = role): WorkflowLibraryStep {
  return { name, role, promptPrefix: '', expectedOutput: '' };
}

describe('resolveRootAgent', () => {
  it('routes a cluster child through its topmost workflow-step ancestor', () => {
    const root = agentOf({
      id: 'root' as AgentId,
      workflowRunId: WF,
      stepId: STEP,
      kind: 'implementer',
    });
    const child = agentOf({
      id: 'child' as AgentId,
      parentAgentId: root.id,
      workflowRunId: WF,
      kind: 'scout',
    });

    const resolved = resolveRootAgent({ agents: [child, root], agentId: child.id });

    expect(resolved).toBe(root);
    if (resolved == null) {
      throw new Error('Expected a root agent');
    }
    expect(agentHomeLens(resolved, classifyAgent(resolved, null))).toBe('workflows');
  });

  it('routes a parallel branch with only a step binding to its orchestrator home', () => {
    const orchestrator = agentOf({
      id: 'orchestrator' as AgentId,
      workflowRunId: WF,
      stepId: STEP,
      kind: 'implementer',
    });
    const branch = agentOf({
      id: 'branch' as AgentId,
      parentAgentId: orchestrator.id,
      stepId: 'branch-step' as StepId,
      kind: 'implementer',
    });

    const resolved = resolveRootAgent({ agents: [branch, orchestrator], agentId: branch.id });

    expect(resolved).toBe(orchestrator);
    if (resolved == null) {
      throw new Error('Expected an orchestrating agent');
    }
    expect(agentHomeLens(resolved, classifyAgent(resolved, null))).toBe('workflows');
  });

  it('stops at the highest available agent when a parent is missing', () => {
    const child = agentOf({ id: 'child' as AgentId, parentAgentId: 'missing' as AgentId });

    expect(resolveRootAgent({ agents: [child], agentId: child.id })).toBe(child);
    expect(resolveRootAgent({ agents: [child], agentId: 'unknown' as AgentId })).toBeNull();
  });

  it('stops safely when the parent chain contains a cycle', () => {
    const first = agentOf({ id: 'first' as AgentId, parentAgentId: 'second' as AgentId });
    const second = agentOf({ id: 'second' as AgentId, parentAgentId: first.id });

    expect(resolveRootAgent({ agents: [first, second], agentId: first.id })).toBe(second);
  });
});

describe('agentHomeLens', () => {
  it('routes a full workflow step agent (workflowRunId + stepId) to workflows', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF, stepId: STEP }), 'implementer')).toBe(
      'workflows',
    );
  });

  it('routes a cluster child without a step binding to agents', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF }), 'implementer')).toBe('agents');
  });

  it('routes a scout sub-agent without a step binding to agents', () => {
    expect(
      agentHomeLens(agentOf({ workflowRunId: WF, parentAgentId: 'p1' as AgentId }), 'scout'),
    ).toBe('agents');
  });

  it('routes a resolver without a step binding to resolve', () => {
    expect(agentHomeLens(agentOf({ workflowRunId: WF }), 'resolver')).toBe('resolve');
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

describe('isStandaloneAgent', () => {
  it('treats a top-level agent with no workflow binding as standalone', () => {
    expect(isStandaloneAgent(agentOf())).toBe(true);
  });

  it('rejects a child agent', () => {
    expect(isStandaloneAgent(agentOf({ parentAgentId: 'parent' as AgentId }))).toBe(false);
  });

  it('rejects an agent bound to a workflow step', () => {
    expect(isStandaloneAgent(agentOf({ workflowRunId: WF, stepId: STEP }))).toBe(false);
  });

  it('keeps an agent that has a workflowRunId but no stepId', () => {
    expect(isStandaloneAgent(agentOf({ workflowRunId: WF }))).toBe(true);
  });
});

describe('selectStandaloneAgents', () => {
  it('filters out child and workflow-bound agents', () => {
    const agents = [
      agentOf({ id: 'standalone' as AgentId }),
      agentOf({ id: 'child' as AgentId, parentAgentId: 'parent' as AgentId }),
      agentOf({ id: 'workflow' as AgentId, workflowRunId: WF, stepId: STEP }),
    ];

    expect(selectStandaloneAgents(agents)).toHaveLength(1);
  });

  it('returns an empty array when given none', () => {
    expect(selectStandaloneAgents([])).toEqual([]);
  });
});

describe('selectNonResolverStandaloneAgents', () => {
  it('keeps a generic standalone agent', () => {
    const agents = [agentOf({ id: 'generic' as AgentId, name: 'explore the repo' })];
    expect(selectNonResolverStandaloneAgents(agents, {})).toHaveLength(1);
  });

  it('excludes a name-classified resolver', () => {
    const agents = [agentOf({ id: 'resolver' as AgentId, name: 'resolve foo' })];
    expect(selectNonResolverStandaloneAgents(agents, {})).toHaveLength(0);
  });

  it('prefers a persisted kind over name inference', () => {
    const agents = [
      agentOf({ id: 'persisted' as AgentId, name: 'resolve foo', kind: 'implementer' }),
    ];
    expect(selectNonResolverStandaloneAgents(agents, {})).toHaveLength(1);
  });

  it('excludes an agent with a persisted resolver kind', () => {
    const agents = [
      agentOf({ id: 'persisted' as AgentId, name: 'explore the repo', kind: 'resolver' }),
    ];
    expect(selectNonResolverStandaloneAgents(agents, {})).toHaveLength(0);
  });

  it('excludes an agent overridden to resolver', () => {
    const agents = [
      agentOf({ id: 'override' as AgentId, name: 'explore the repo', kind: 'implementer' }),
    ];
    const overrides: Record<string, AgentKind> = { override: 'resolver' };

    expect(selectNonResolverStandaloneAgents(agents, overrides)).toHaveLength(0);
  });

  it('prefers a non-resolver override over persisted kind and name inference', () => {
    const agents = [agentOf({ id: 'override' as AgentId, name: 'resolve foo', kind: 'resolver' })];
    const overrides: Record<string, AgentKind> = { override: 'scout' };

    expect(selectNonResolverStandaloneAgents(agents, overrides)).toHaveLength(1);
  });

  it('excludes a workflow-step agent that is not standalone', () => {
    const agents = [
      agentOf({
        id: 'workflow' as AgentId,
        name: 'step agent',
        workflowRunId: WF,
        stepId: STEP,
      }),
    ];

    expect(selectNonResolverStandaloneAgents(agents, {})).toHaveLength(0);
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
      expect(kindRouting({ kind }).effort).toBe('low');
      expect(kindRouting({ kind }).model).toMatch(/haiku/i);
    }
  });

  it('implementer / debugger / reviewer / pr-reviewer / tester / resolver → sonnet, medium effort', () => {
    for (const kind of [
      'implementer',
      'debugger',
      'reviewer',
      'pr-reviewer',
      'tester',
      'resolver',
    ] as AgentKind[]) {
      expect(kindRouting({ kind }).effort).toBe('medium');
      expect(kindRouting({ kind }).model).toMatch(/sonnet/i);
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
      'pr-reviewer',
      'docs',
      'generic',
    ];
    for (const kind of allKinds) {
      expect(AGENT_KIND_DEFAULTS[kind].visible).not.toBe(false);
    }
  });

  it('planner → opus, high effort', () => {
    expect(kindRouting({ kind: 'planner' }).effort).toBe('high');
    expect(kindRouting({ kind: 'planner' }).model).toMatch(/opus/i);
  });

  it('every kind names a model its provider actually ships', () => {
    for (const kind of ALL_KINDS) {
      const { provider, model } = kindRouting({ kind });
      const known = PROVIDER_CAPABILITIES[provider].models.some((entry) => entry.id === model);
      expect(known, `${kind} → ${provider}/${model}`).toBe(true);
    }
  });

  it('every kind names an effort its model supports', () => {
    for (const kind of ALL_KINDS) {
      const { provider, model, effort } = kindRouting({ kind });
      expect(EFFORT_LEVELS, `${kind} → ${effort}`).toContain(effort);
      const levels = PROVIDER_CAPABILITIES[provider].models.find(
        (entry) => entry.id === model,
      )?.effort;
      if (levels != null) {
        expect(levels, `${kind} → ${model}/${effort}`).toContain(effort);
      }
    }
  });

  it('tracks ROLE_DEFAULTS as the single source of truth for routing', () => {
    expect(kindRouting({ kind: 'planner' }).model).toBe(ROLE_DEFAULTS.planner.model);
    expect(kindRouting({ kind: 'implementer' }).model).toBe(ROLE_DEFAULTS.implementer.model);
    expect(kindRouting({ kind: 'debugger' }).model).toBe(ROLE_DEFAULTS.investigator.model);
  });
});

describe('kindRouting role overrides', () => {
  it('lets a stored role preference win over the compiled default', () => {
    const routing = kindRouting({
      kind: 'debugger',
      roleModels: {
        investigator: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
      },
    });

    expect(routing).toEqual({ provider: 'anthropic', model: 'claude-opus-5', effort: 'max' });
  });

  it('lets an override beat the cheap-tier downgrade', () => {
    const routing = kindRouting({
      kind: 'scout',
      roleModels: {
        scout: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'high' },
      },
    });

    expect(routing.model).toBe('claude-sonnet-4-6');
    expect(routing.effort).toBe('high');
  });

  it('keeps the cheap-tier downgrade when no override is stored for the role', () => {
    const routing = kindRouting({
      kind: 'scout',
      roleModels: {
        planner: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'low' },
      },
    });

    expect(routing.model).toMatch(/haiku/i);
    expect(routing.effort).toBe('low');
  });

  it('keeps a pinned model and defaults the effort the model cannot honor', () => {
    const routing = kindRouting({
      kind: 'reviewer',
      roleModels: {
        reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'minimal' },
      },
    });

    expect(routing.model).toBe('claude-opus-5');
    expect(routing.effort).toBe(ROLE_DEFAULTS.reviewer.effort);
  });

  it('pins a role to a cheap model that has no effort ladder', () => {
    const routing = kindRouting({
      kind: 'debugger',
      roleModels: {
        investigator: { providerId: 'anthropic', model: 'claude-haiku-4-5', effort: 'low' },
      },
    });

    expect(routing.provider).toBe('anthropic');
    expect(routing.model).toBe('claude-haiku-4-5');
  });

  it('drops an override whose model the registry no longer ships', () => {
    const routing = kindRouting({
      kind: 'reviewer',
      roleModels: {
        reviewer: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'high' },
      },
    });

    expect(routing.model).toBe(ROLE_DEFAULTS.reviewer.model);
    expect(routing.effort).toBe(ROLE_DEFAULTS.reviewer.effort);
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
    ['pr reviewer', 'pr-reviewer'],
    ['PR review #42', 'pr-reviewer'],
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
    for (const kind of [
      'scout',
      'reviewer',
      'pr-reviewer',
      'tester',
      'docs',
      'planner',
      'resolver',
    ] as const) {
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
