import type { AgentId } from '@goodboy/types';
import type { AutoPendingMessage, AutoTreeView } from '../../../store/slices/auto-view/state';
import { QUEUE_DELIVERY_PREFIX } from '../../../store/slices/agentQueue/QUEUE_DELIVERY_PREFIX';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly rootAgentId: AgentId;
  readonly messageId: string;
};

export const pendingLeadRowOf = ({
  views,
  rootAgentId,
  messageId,
}: Params): AutoPendingMessage | null => {
  const joinKey = `user:${QUEUE_DELIVERY_PREFIX}${messageId}`;
  return (
    views
      .filter((view) => view.tree.rootAgentId === rootAgentId)
      .flatMap((view) => view.pendingMessages)
      .find((message) => message.joinKey === joinKey) ?? null
  );
};
