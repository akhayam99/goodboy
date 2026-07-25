import type { AgentId, AgentStatus } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { AGENT_KIND_META, type AgentKind } from '../../../session/agent-kind';

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

export const outcomeWord = (status: SpawnNodeStatus): string => {
  if (status === 'queued') {
    return 'queued';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'done') {
    return 'done';
  }
  if (status === 'stalled') {
    return 'stalled';
  }
  return '';
};

export const outcomeTone = (status: SpawnNodeStatus): Tone => {
  if (status === 'running') {
    return 'info';
  }
  if (status === 'done') {
    return 'success';
  }
  if (status === 'stalled') {
    return 'danger';
  }
  return 'neutral';
};

const KIND_EYEBROW_LABEL: Partial<Record<AgentKind, string>> = {
  scout: 'scout fan-out',
  implementer: 'implementation',
  resolver: 'resolve',
};

export const kindEyebrow = (
  kind: AgentKind,
  done: number,
  total: number,
): { label: string; tone?: Tone } => {
  const base = KIND_EYEBROW_LABEL[kind] ?? AGENT_KIND_META[kind].label.toLowerCase();
  return { label: `${base} ${done}/${total}` };
};
