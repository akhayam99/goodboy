import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
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

  it('also pins the picked model on the selected agent', () => {
    useAppStore.setState({ selectedAgentId: { [SESSION_ID]: AGENT_ID } });
    const { result } = renderHook(() => useTurnRouting({ session: makeSession() }));

    act(() => {
      result.current.setSelectedModel('claude-opus-5');
    });

    expect(setSessionConfig).toHaveBeenCalledWith(SESSION_ID, { modelOverride: 'claude-opus-5' });
    expect(setAgentConfig).toHaveBeenCalledWith(SESSION_ID, AGENT_ID, {
      modelOverride: 'claude-opus-5',
    });
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
});
