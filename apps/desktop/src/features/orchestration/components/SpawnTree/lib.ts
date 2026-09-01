import type { AgentId, AgentStatus } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';

export type SpawnNodeStatus = 'planned' | 'queued' | 'running' | 'done' | 'stalled';

export type SpawnNode = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: AgentKind;
  readonly status: SpawnNodeStatus;
  readonly costUsd: number;
  readonly outputSummary: string | null;
  readonly children: ReadonlyArray<SpawnNode>;
  readonly isSelected: boolean;
};

export const statusToNodeStatus = (status: AgentStatus | 'planned'): SpawnNodeStatus => {
  if (status === 'pending') {
    return 'queued';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'completed') {
    return 'done';
  }
  if (status === 'failed') {
    return 'stalled';
  }
  return 'planned';
};
