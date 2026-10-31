import type { AgentId } from '@goodboy/types';
import type { RailInk } from '../workTreeModel/railGeometry';

export type RunTreeInsert = {
  readonly agentId: AgentId | null;
  readonly slotWidth: number;
  readonly ink: RailInk | null;
  readonly hasLineBelow: boolean;
};
