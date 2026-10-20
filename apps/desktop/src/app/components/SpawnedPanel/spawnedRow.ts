import type { WorkNodeState } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { AgentKind } from '../../../features/session/agent-kind';

export type SpawnedRow = Readonly<{
  id: string;
  agentId: AgentId;
  level: number;
  hasChildren: boolean;
  title: string;
  detail: string | null;
  role: AgentKind;
  node: WorkNodeState;
  word: string;
  isLive: boolean;
}>;
