import type { FactCardSpec, WorkNodeState } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';

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
}>;

export type SpawnedRowFold = Readonly<{
  isExpanded: boolean;
  count: number;
  onToggle: () => void;
}>;
