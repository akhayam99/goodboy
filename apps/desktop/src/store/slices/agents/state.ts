import type { AgentId, ProviderRunId, TurnState, ProviderId, EffortLevel } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';
import type { DraftAttachment } from './setAgentAttachments';

export type AgentsState = {
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentTurnState: Readonly<Record<AgentId, TurnState>>;
  readonly agentModelOverride: Readonly<Record<AgentId, string>>;
  readonly agentProviderOverride: Readonly<Record<AgentId, ProviderId>>;
  readonly agentEffortOverride: Readonly<Record<AgentId, EffortLevel>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
  readonly agentDraft: Readonly<Record<AgentId, string>>;
  readonly agentAttachments: Readonly<Record<AgentId, ReadonlyArray<DraftAttachment>>>;
};

export const agentsInitialState: AgentsState = {
  agentRunHistory: {},
  agentTurnState: {},
  agentModelOverride: {},
  agentProviderOverride: {},
  agentEffortOverride: {},
  agentKindOverride: {},
  agentDraft: {},
  agentAttachments: {},
};
