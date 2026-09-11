import { describe, expect, it } from 'vitest';
import { getCheapModel } from '@goodboy/core';
import type { Step, StepId, WorkflowId } from '@goodboy/types';
import { resolveStepRouting } from './resolveStepRouting';

const WF_ID = 'wf-1' as WorkflowId;

const step = (patch: Partial<Step>): Step =>
  ({
    id: 's-1' as StepId,
    workflowId: WF_ID,
    ordinal: 0,
    name: 'Do the thing',
    promptPrefix: '',
    ...patch,
  }) as Step;

const decidedStep = (): Step =>
  step({
    role: 'implementer',
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
    effort: 'high',
    routingDecision: {
      version: 1,
      proposal: null,
      selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      source: 'agent',
      reason: 'The refactor needs deep reasoning.',
      adjustment: 'none',
      executed: null,
    },
  });

describe('resolveStepRouting', () => {
  it('keeps the decided selection above every configured preference', () => {
    const routing = resolveStepRouting({
      step: decidedStep(),
      kind: 'implementer',
      roleModels: {
        implementer: { providerId: 'anthropic', model: 'sonnet-5', effort: 'medium' },
      },
      sessionProvider: 'anthropic',
      sessionEffort: 'low',
    });

    expect(routing).toEqual({ provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' });
  });

  it('lets an explicit lock win over the decision beside it', () => {
    const locked = {
      ...decidedStep(),
      routingLock: {
        version: 1,
        pick: { provider: 'anthropic', model: 'opus-5', effort: 'xhigh' },
        origin: 'user',
      },
    } as Step;

    const routing = resolveStepRouting({ step: locked, kind: 'implementer', roleModels: null });

    expect(routing).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'xhigh' });
  });

  it('routes a roleless agent on the session model above the kind default', () => {
    const withSession = resolveStepRouting({
      step: null,
      kind: 'generic',
      roleModels: null,
      sessionProvider: 'anthropic',
      sessionModel: 'opus-5',
    });
    const withoutSession = resolveStepRouting({
      step: null,
      kind: 'generic',
      roleModels: null,
      sessionProvider: 'anthropic',
    });

    expect(withSession.model).toBe('opus-5');
    expect(withoutSession.model).not.toBe('opus-5');
  });

  it('lets an explicit step model win over the agent pin', () => {
    const routing = resolveStepRouting({
      step: step({ modelOverride: 'opus-5' }),
      kind: 'generic',
      roleModels: null,
      agentModel: 'haiku-4.5',
    });

    expect(routing.model).toBe('opus-5');
  });

  it('prefers the role recommendation over the name-inferred kind default', () => {
    const byRole = resolveStepRouting({
      step: step({ role: 'planner' }),
      kind: 'generic',
      roleModels: null,
    });
    const byKind = resolveStepRouting({ step: null, kind: 'generic', roleModels: null });

    expect(byRole.model).not.toBe(byKind.model);
    expect(byRole.effort).toBe('high');
  });

  it('falls back to the agent pin when the step carries no routing', () => {
    const routing = resolveStepRouting({
      step: step({}),
      kind: 'generic',
      roleModels: null,
      agentModel: 'sonnet-5',
    });

    expect(routing.model).toBe('sonnet-5');
  });

  it('takes the effort from the step when the orchestrator set one', () => {
    const routing = resolveStepRouting({
      step: step({ role: 'implementer', effort: 'xhigh' }),
      kind: 'generic',
      roleModels: null,
    });

    expect(routing.effort).toBe('xhigh');
  });

  it('reports the provider the agent actually runs on, not one guessed from the model', () => {
    const routing = resolveStepRouting({
      step: step({ modelOverride: 'gpt-5.6-sol' }),
      kind: 'generic',
      roleModels: null,
      agentProvider: 'cursor',
    });

    expect(routing.provider).toBe('cursor');
    expect(routing.model).toBe('gpt-5.6-sol');
  });

  it('lets the provider pinned on the step win over the one of the agent', () => {
    const routing = resolveStepRouting({
      step: step({ providerOverride: 'codex' }),
      kind: 'generic',
      roleModels: null,
      agentProvider: 'cursor',
    });

    expect(routing.provider).toBe('codex');
  });

  it('keeps the Provider studio role preference above the session default', () => {
    const routing = resolveStepRouting({
      step: step({ role: 'scout' }),
      kind: 'scout',
      roleModels: { scout: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'medium' } },
      sessionProvider: 'cursor',
    });

    expect(routing.provider).toBe('codex');
    expect(routing.model).toBe('gpt-5.6-sol');
    expect(routing.effort).toBe('medium');
  });

  it('routes the session default above the hardcoded fallback when no preference exists', () => {
    const routing = resolveStepRouting({
      step: null,
      kind: 'scout',
      roleModels: null,
      sessionProvider: 'codex',
    });

    expect(routing.provider).toBe('codex');
    expect(routing.model).toBe(getCheapModel('codex'));
    expect(routing.effort).toBe('low');
  });

  it('lets the step pin beat the session default', () => {
    const routing = resolveStepRouting({
      step: step({ providerOverride: 'anthropic' }),
      kind: 'generic',
      roleModels: null,
      sessionProvider: 'codex',
    });

    expect(routing.provider).toBe('anthropic');
  });

  it('keeps a real agent override above the role preference', () => {
    const routing = resolveStepRouting({
      step: step({ role: 'scout' }),
      kind: 'scout',
      roleModels: { scout: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'medium' } },
      agentProvider: 'cursor',
    });

    expect(routing.provider).toBe('cursor');
  });

  it('applies the session effort only below every explicit effort', () => {
    const plain = resolveStepRouting({
      step: step({}),
      kind: 'generic',
      roleModels: null,
      sessionProvider: 'anthropic',
      sessionEffort: 'high',
    });
    const preferred = resolveStepRouting({
      step: step({ role: 'scout' }),
      kind: 'scout',
      roleModels: { scout: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'medium' } },
      sessionEffort: 'high',
    });

    expect(plain.effort).toBe('high');
    expect(preferred.effort).toBe('medium');
  });
});
