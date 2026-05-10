import { describe, expect, it } from 'vitest';
import type { WorkflowLibraryStep } from '@kay-am/core';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  type AgentKind,
  inferAgentKindFromName,
  inferAgentKindFromStep,
} from './agentKind';

const ALL_KINDS: ReadonlyArray<AgentKind> = [
  'scout',
  'planner',
  'implementer',
  'debugger',
  'reviewer',
  'docs',
  'generic',
];

function makeStep(role: string, name = role): WorkflowLibraryStep {
  return { name, role, promptPrefix: '', expectedOutput: '' };
}

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

  it('implementer / debugger / reviewer → sonnet, medium effort', () => {
    for (const kind of ['implementer', 'debugger', 'reviewer'] as AgentKind[]) {
      expect(AGENT_KIND_DEFAULTS[kind].effort).toBe('medium');
      expect(AGENT_KIND_DEFAULTS[kind].model).toMatch(/sonnet/i);
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
    ['tester', 'reviewer'],
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
    ['Test', 'reviewer'],
    ['Write docs', 'docs'],
    ['agent 1', 'generic'],
  ] as [string, AgentKind][])('name %s → %s', (name, expected) => {
    expect(inferAgentKindFromName(name)).toBe(expected);
  });
});
