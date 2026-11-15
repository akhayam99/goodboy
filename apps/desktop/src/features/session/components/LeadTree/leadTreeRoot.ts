import type { AgentId } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';

export type LeadTreeRoot = Readonly<{
  agentId: AgentId;
  title: string;
  node: WorkNodeState;
  word: string;
}>;
