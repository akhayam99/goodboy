import type { AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoTreeOfAgent, type AutoTreeOfAgent } from './autoTreeOfAgent';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agentId: AgentId | null;
};

export const autoKindOf = ({ views, agentId }: Params): AutoTreeOfAgent['kind'] | null =>
  agentId === null ? null : (autoTreeOfAgent({ views, agentId })?.kind ?? null);
