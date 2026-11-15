import type { ReactNode } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AgentQueuedTurn } from '../../../store/slices/agentQueue/types';
import { useLeadTree, type LeadTreeModel } from '../hooks/useLeadTree';
import type { NoteSource } from './noteNodesOf';

export type LeadTreeDataModel = LeadTreeModel;

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly queued: Readonly<{
    rows: ReadonlyArray<NoteSource>;
    onEdit: (id: string) => void;
    onRemove: (id: string) => void;
  }>;
  readonly children: (model: LeadTreeDataModel) => ReactNode;
};

export const LeadTreeData = ({ sessionId, rootAgentId, queue, queued, children }: Props) =>
  children(useLeadTree({ sessionId, rootAgentId, queue, queued }));
