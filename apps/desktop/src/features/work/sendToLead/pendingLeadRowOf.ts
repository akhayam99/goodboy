import type { AgentId } from '@goodboy/types';
import type { AutoPendingMessage, AutoTreeView } from '../../../store/slices/auto-view/state';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly rootAgentId: AgentId;
  readonly text: string;
};

export const pendingLeadRowOf = ({ views, rootAgentId, text }: Params): AutoPendingMessage | null =>
  views
    .filter((view) => view.tree.rootAgentId === rootAgentId)
    .flatMap((view) => view.pendingMessages)
    .find((message) => message.text === text) ?? null;
