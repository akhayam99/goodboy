import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { getCheapModel, resolveModelForProvider } from '@goodboy/core';
import { agentReferenceRouting } from './agentReferenceRouting';

const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'ses-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'agent-1' as AgentId,
  sessionId: 'ses-1' as SessionId,
  ordinal: 0,
  name: 'Scout',
  status: 'pending',
  kind: 'scout',
  ...overrides,
});

const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: 'step-1' as StepId,
  workflowId: 'wf-1' as WorkflowId,
  ordinal: 0,
  name: 'Scout',
  promptPrefix: '',
  ...overrides,
});

describe('agentReferenceRouting', () => {
  it('resolves a scout to the cheap role default, not the session default', () => {
    const result = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession({
        providerPreference: {
          defaultProvider: 'anthropic',
          defaultModel: 'opus-5',
          allowTurnOverride: true,
        },
      }),
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'haiku-4.5', effort: 'low' });
  });

  it('prefers the step pin over the role default', () => {
    const result = agentReferenceRouting({
      agent: makeAgent({ stepId: 'step-1' as StepId }),
      stepConfig: makeStep({
        role: 'scout',
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6',
        effort: 'high',
      }),
      roleModels: null,
      session: makeSession(),
    });

    expect(result).toEqual({ provider: 'codex', model: 'gpt-5.6', effort: 'high' });
  });

  it('honors the Provider studio role preference for the agent kind', () => {
    const result = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: { scout: { providerId: 'anthropic', model: 'sonnet-5', effort: 'high' } },
      session: makeSession(),
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'sonnet-5', effort: 'high' });
  });

  it('classifies via the kind override before the persisted kind', () => {
    const result = agentReferenceRouting({
      agent: makeAgent({ kind: 'implementer', name: 'agent 1' }),
      stepConfig: null,
      roleModels: null,
      session: makeSession(),
      kindOverride: 'scout',
    });

    expect(result.model).toBe('haiku-4.5');
    expect(result.effort).toBe('low');
  });

  it('falls back to the session default when no agent is selected', () => {
    const result = agentReferenceRouting({
      agent: null,
      stepConfig: null,
      roleModels: null,
      session: makeSession({
        providerPreference: {
          defaultProvider: 'anthropic',
          defaultModel: 'opus-5',
          allowTurnOverride: true,
        },
        effort: 'high',
      }),
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'high' });
  });

  it('defaults the session fallback to medium effort and the provider turn model', () => {
    const result = agentReferenceRouting({
      agent: null,
      stepConfig: null,
      roleModels: null,
      session: makeSession(),
    });

    expect(result.provider).toBe('anthropic');
    expect(result.effort).toBe('medium');
    expect(result.model.length).toBeGreaterThan(0);
  });

  it('normalizes legacy model ids to catalog keys', () => {
    const result = agentReferenceRouting({
      agent: null,
      stepConfig: null,
      roleModels: null,
      session: makeSession({
        providerPreference: {
          defaultProvider: 'anthropic',
          defaultModel: 'claude-haiku-4-5',
          allowTurnOverride: true,
        },
      }),
    });

    expect(result.model).toBe('haiku-4.5');
  });

  it('follows the session default provider when the role has no preference', () => {
    const result = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession({
        providerPreference: { defaultProvider: 'codex', allowTurnOverride: true },
      }),
    });

    expect(result.provider).toBe('codex');
    expect(result.model).toBe(
      resolveModelForProvider({ provider: 'codex', modelId: getCheapModel('codex') }),
    );
    expect(result.effort).toBe('low');
  });

  it('keeps the role preference above the session default', () => {
    const result = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: { scout: { providerId: 'anthropic', model: 'sonnet-5', effort: 'high' } },
      session: makeSession({
        providerPreference: { defaultProvider: 'codex', allowTurnOverride: true },
      }),
    });

    expect(result).toEqual({ provider: 'anthropic', model: 'sonnet-5', effort: 'high' });
  });

  it('recomputes the same reference regardless of persisted agent overrides', () => {
    const pristine = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession(),
    });
    const overwritten = agentReferenceRouting({
      agent: makeAgent({ modelOverride: 'opus-5', providerOverride: 'anthropic', effort: 'max' }),
      stepConfig: null,
      roleModels: null,
      session: makeSession(),
    });

    expect(overwritten).toEqual(pristine);
  });

  it('lets a valid session provider override stand in for the session default', () => {
    const result = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession({ providerOverride: 'codex' }),
    });

    expect(result.provider).toBe('codex');
  });

  it('ignores a session provider override that names no known provider', () => {
    const withGarbage = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession({ providerOverride: 'not-a-provider' }),
    });
    const pristine = agentReferenceRouting({
      agent: makeAgent(),
      stepConfig: null,
      roleModels: null,
      session: makeSession(),
    });

    expect(withGarbage).toEqual(pristine);
  });
});
