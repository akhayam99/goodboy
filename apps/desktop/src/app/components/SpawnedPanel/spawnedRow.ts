import type { FactCardSpec, WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentId } from '@goodboy/types';
import type { ShownRouting } from '../../../features/auto/executedRoutingOf';
import type { AgentKind } from '../../../features/session/agent-kind';
import type { HelperUrgency } from './helperUrgencyOf';

export type SpawnedRowModelSource = Readonly<{
  agent: Agent;
  routing: ShownRouting | null;
}>;

export type SpawnedRow = Readonly<{
  id: string;
  agentId: AgentId;
  level: number;
  hasChildren: boolean;
  title: string;
  card: FactCardSpec;
  role: AgentKind;
  node: WorkNodeState;
  word: string;
  isLive: boolean;
  model?: SpawnedRowModelSource | null;
}>;

export type SpawnedRowFold = Readonly<{
  isExpanded: boolean;
  count: number;
  urgency: HelperUrgency | null;
  onToggle: () => void;
}>;
