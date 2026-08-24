import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useTurnRouting } from './useTurnRouting';

const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'ses-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: SESSION_ID,
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

const makeScoutRow = (overrides: Partial<Agent> = {}): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Scout',
  status: 'pending',
  kind: 'scout',
  providerOverride: 'anthropic',
  modelOverride: 'claude-haiku-4-5',
  effort: 'low',
  ...overrides,
});

const selectScout = (overrides: Partial<Agent> = {}) => {
  useAppStore.setState({
    selectedAgentId: { [SESSION_ID]: AGENT_ID },
    sessionPhaseRuns: { [SESSION_ID]: [makeScoutRow(overrides)] },
    agentModelOverride: { [AGENT_ID]: 'claude-haiku-4-5' },
    agentProviderOverride: { [AGENT_ID]: 'anthropic' },
    agentEffortOverride: { [AGENT_ID]: 'low' },
  });
};

const setSessionConfig = vi.fn(async () => {});
const setAgentConfig = vi.fn(async () => {});

beforeEach(() => {
  setSessionConfig.mockClear();
  setAgentConfig.mockClear();
  useAppStore.setState({
    setSessionConfig,
    setAgentConfig,
    selectedAgentId: {},
    sessionPhaseRuns: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    agentKindOverride: {},
    workspaceOverrides: {},
    phaseTemplates: {},
  });
});

describe('useTurnRouting', () => {
  it('persists a picked model on the session so spawned agents inherit it', () => {
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.setSelectedModel('claude-opus-5');
    });

    expect(setSessionConfig).toHaveBeenCalledWith(SESSION_ID, { modelOverride: 'claude-opus-5' });
  });

  it('pins the picked model on the selected agent and leaves the session config untouched', () => {
    useAppStore.setState({ selectedAgentId: { [SESSION_ID]: AGENT_ID } });
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.setSelectedModel('claude-opus-5');
    });

    expect(setAgentConfig).toHaveBeenCalledWith(SESSION_ID, AGENT_ID, {
      modelOverride: 'claude-opus-5',
    });
    expect(setSessionConfig).not.toHaveBeenCalled();
  });

  it('keeps the routing override and the connected provider list referentially stable', () => {
    useAppStore.setState({
      providers: [
        { id: 'anthropic', connection: 'connected' },
        { id: 'cursor', connection: 'connected' },
      ] as never,
    });
    const session = makeSession();
    const { result, rerender } = renderHook(() => useTurnRouting({ session }));

    const firstOverride = result.current.routingOverride;
    const firstProviderIds = result.current.connectedProviderIds;
    rerender();

    expect(result.current.routingOverride).toBe(firstOverride);
    expect(result.current.connectedProviderIds).toBe(firstProviderIds);
  });

  it('clears the session model when the provider changes', () => {
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.onSelectProvider('cursor');
    });

    expect(setSessionConfig).toHaveBeenCalledWith(SESSION_ID, {
      providerOverride: 'cursor',
      modelOverride: null,
    });
  });

  it('resets to the session default when no agent is selected', () => {
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.onResetTurnOverride();
    });

    expect(setSessionConfig).toHaveBeenCalledWith(SESSION_ID, { providerOverride: null });
    expect(setSessionConfig).toHaveBeenCalledWith(SESSION_ID, { modelOverride: null });
    expect(setAgentConfig).not.toHaveBeenCalled();
  });
});

describe('useTurnRouting, agent reference', () => {
  it('reads a scout pinned to haiku as its own reference, not an override', () => {
    selectScout();
    const session = makeSession({
      providerPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'opus-5',
        allowTurnOverride: true,
      },
    });
    const { result } = renderHook(() => useTurnRouting({ session }));

    expect(result.current.referenceProvider).toBe('anthropic');
    expect(result.current.referenceModel).toBe('haiku-4.5');
    expect(result.current.referenceEffort).toBe('low');
    expect(result.current.effectiveProvider).toBe(result.current.referenceProvider);
    expect(result.current.effectiveModel).toBe(result.current.referenceModel);
  });

  it('initialises effort from the agent, not the session', () => {
    selectScout();
    const session = makeSession({ effort: 'high' });
    const { result } = renderHook(() => useTurnRouting({ session }));

    expect(result.current.effort).toBe('low');
    expect(result.current.effectiveEffort).toBe('low');
  });

  it('reset returns the agent to its reference, not the session default', () => {
    selectScout();
    const session = makeSession({
      providerPreference: {
        defaultProvider: 'anthropic',
        defaultModel: 'opus-5',
        allowTurnOverride: true,
      },
    });
    const { result } = renderHook(() => useTurnRouting({ session }));

    act(() => {
      result.current.onSelectModel('opus-5');
    });

    expect(result.current.effectiveModel).toBe('opus-5');
    expect(result.current.routingOverride?.explicit).toBe(true);

    act(() => {
      result.current.onResetTurnOverride();
    });

    expect(result.current.effectiveProvider).toBe('anthropic');
    expect(result.current.effectiveModel).toBe('haiku-4.5');
    expect(result.current.effectiveEffort).toBe('low');
    expect(result.current.routingOverride?.explicit).toBe(false);
    expect(setAgentConfig).toHaveBeenLastCalledWith(SESSION_ID, AGENT_ID, {
      providerOverride: 'anthropic',
      modelOverride: 'haiku-4.5',
      effort: 'low',
    });
    expect(setSessionConfig).not.toHaveBeenCalled();
  });

  it('reset realigns a provider excursion back to the reference', () => {
    selectScout();
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.onSelectProvider('cursor');
    });

    expect(result.current.effectiveProvider).toBe('cursor');

    act(() => {
      result.current.onResetTurnOverride();
    });

    expect(result.current.effectiveProvider).toBe('anthropic');
    expect(result.current.effectiveModel).toBe('haiku-4.5');
    expect(setAgentConfig).toHaveBeenLastCalledWith(SESSION_ID, AGENT_ID, {
      providerOverride: 'anthropic',
      modelOverride: 'haiku-4.5',
      effort: 'low',
    });
    expect(setSessionConfig).not.toHaveBeenCalled();
  });

  it('resolves the reference from the workflow step pin when the agent has one', () => {
    selectScout({
      stepId: 'step-1' as Agent['stepId'],
      workflowRunId: 'run-1' as Agent['workflowRunId'],
    });
    useAppStore.setState({
      phaseTemplates: {
        ['ws-1' as WorkspaceId]: [
          {
            id: 'wf-1',
            workspaceId: 'ws-1',
            name: 'wf',
            description: '',
            steps: [
              {
                id: 'step-1',
                workflowId: 'wf-1',
                ordinal: 0,
                name: 'Scout',
                promptPrefix: '',
                role: 'scout',
                providerOverride: 'codex',
                modelOverride: 'gpt-5.6',
                effort: 'high',
              },
            ],
            createdAt: NOW,
            updatedAt: NOW,
          },
        ] as never,
      },
    });
    const session = makeSession({
      workflowRuns: [
        {
          id: 'run-1',
          workflowId: 'wf-1',
          ordinal: 0,
          currentStep: 0,
          autoRun: false,
          triggerMode: 'manual',
          executionMode: 'static',
        },
      ] as never,
    });
    const { result } = renderHook(() => useTurnRouting({ session }));

    expect(result.current.referenceProvider).toBe('codex');
    expect(result.current.referenceModel).toBe('gpt-5.6');
    expect(result.current.referenceEffort).toBe('high');
  });
});
