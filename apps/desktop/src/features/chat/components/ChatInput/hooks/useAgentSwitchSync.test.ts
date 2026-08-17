import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderId, Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { EffortLevel } from '../../../utils/chat-constants';
import { useAgentSwitchSync } from './useAgentSwitchSync';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const SESSION = { id: 'session-1', workspaceId: WORKSPACE_ID } as unknown as Session;
const AGENT_A = 'agent-a' as AgentId;
const AGENT_B = 'agent-b' as AgentId;

const setAgentConfig = vi.fn(async () => undefined);

const spies = {
  setIsPicked: vi.fn(),
  setSelectedProviderState: vi.fn(),
  setSelectedModelState: vi.fn(),
  setEffortState: vi.fn(),
  setVerbosityState: vi.fn(),
  setRightSizePending: vi.fn(),
  setRightSizeDismissed: vi.fn(),
  setScopePending: vi.fn(),
  setScopeNudgeEventId: vi.fn(),
};

type MountParams = {
  readonly provider: ProviderId | null;
  readonly model: string | null;
  readonly effort: EffortLevel;
};

const mount = ({ provider, model, effort }: MountParams) =>
  renderHook(
    ({ selectedAgentId }: { readonly selectedAgentId: AgentId | null }) =>
      useAgentSwitchSync({
        session: SESSION,
        selectedAgentId,
        currentProviderRef: { current: provider },
        currentModelRef: { current: model },
        currentEffortRef: { current: effort },
        ...spies,
      }),
    { initialProps: { selectedAgentId: AGENT_A as AgentId | null } },
  );

beforeEach(() => {
  setAgentConfig.mockClear();
  for (const spy of Object.values(spies)) {
    spy.mockClear();
  }
  useAppStore.setState({
    setAgentConfig,
    workspaceOverrides: {},
    sessionPhaseRuns: {},
    agentProviderOverride: {},
    agentModelOverride: {},
    agentEffortOverride: {},
  });
});

describe('useAgentSwitchSync', () => {
  it('does nothing on the first render', () => {
    mount({ provider: 'claude' as ProviderId, model: 'opus', effort: 'high' as EffortLevel });
    expect(setAgentConfig).not.toHaveBeenCalled();
    expect(spies.setIsPicked).not.toHaveBeenCalled();
  });

  it('persists the outgoing agent routing on a switch', () => {
    const { rerender } = mount({
      provider: 'claude' as ProviderId,
      model: 'opus',
      effort: 'high' as EffortLevel,
    });
    rerender({ selectedAgentId: AGENT_B });
    expect(setAgentConfig).toHaveBeenCalledWith(SESSION.id, AGENT_A, {
      providerOverride: 'claude',
      modelOverride: 'opus',
      effort: 'high',
    });
  });

  it('does not persist an outgoing agent with no routing of its own', () => {
    const { rerender } = mount({ provider: null, model: null, effort: 'high' as EffortLevel });
    rerender({ selectedAgentId: AGENT_B });
    expect(setAgentConfig).not.toHaveBeenCalled();
  });

  it('restores the incoming agent routing and resets the nudges', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION.id]: [
          { id: AGENT_B, providerOverride: 'codex', modelOverride: 'gpt', effort: 'low' },
        ],
      },
    } as never);
    const { rerender } = mount({ provider: null, model: null, effort: 'high' as EffortLevel });
    rerender({ selectedAgentId: AGENT_B });
    expect(spies.setIsPicked).toHaveBeenCalledWith(false);
    expect(spies.setSelectedProviderState).toHaveBeenCalledWith('codex');
    expect(spies.setSelectedModelState).toHaveBeenCalledWith('gpt');
    expect(spies.setEffortState).toHaveBeenCalledWith('low');
    expect(spies.setRightSizePending).toHaveBeenCalledWith(null);
    expect(spies.setRightSizeDismissed).toHaveBeenCalledWith(false);
    expect(spies.setScopePending).toHaveBeenCalledWith(null);
    expect(spies.setScopeNudgeEventId).toHaveBeenCalledWith(null);
  });

  it('restores a live workflow routing override before the original agent routing', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION.id]: [
          { id: AGENT_B, providerOverride: 'anthropic', modelOverride: 'claude-haiku-4-5' },
        ],
      },
      agentProviderOverride: { [AGENT_B]: 'anthropic' },
      agentModelOverride: { [AGENT_B]: 'claude-opus-5' },
      agentEffortOverride: { [AGENT_B]: 'high' },
    } as never);
    const { rerender } = mount({ provider: null, model: null, effort: 'low' as EffortLevel });
    rerender({ selectedAgentId: AGENT_B });
    expect(spies.setSelectedProviderState).toHaveBeenCalledWith('anthropic');
    expect(spies.setSelectedModelState).toHaveBeenCalledWith('claude-opus-5');
    expect(spies.setEffortState).toHaveBeenCalledWith('high');
  });

  it('clears the routing when the incoming agent has none', () => {
    const { rerender } = mount({ provider: null, model: null, effort: 'high' as EffortLevel });
    rerender({ selectedAgentId: AGENT_B });
    expect(spies.setSelectedProviderState).toHaveBeenCalledWith(null);
    expect(spies.setSelectedModelState).toHaveBeenCalledWith(null);
    expect(spies.setEffortState).not.toHaveBeenCalled();
  });

  it('falls back to the workspace default verbosity', () => {
    useAppStore.setState({
      workspaceOverrides: { [WORKSPACE_ID]: { defaultVerbosity: 'concise' } },
    } as never);
    const { rerender } = mount({ provider: null, model: null, effort: 'high' as EffortLevel });
    rerender({ selectedAgentId: AGENT_B });
    expect(spies.setVerbosityState).toHaveBeenCalledWith('concise');
  });
});
