import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { useChatDefaultModel } from '../../../../../../shared/hooks/useChatDefaultModel';
import { pinnedModelCount } from './pinnedModelCount';

type Props = {
  readonly providerId: ProviderId;
  readonly workspaceId: WorkspaceId;
};

export const PinnedCount = ({ providerId, workspaceId }: Props) => {
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const chat = useChatDefaultModel({ workspaceId });
  const count = pinnedModelCount({
    overrides,
    chatProvider: chat.saved?.provider ?? null,
    providerId,
  });
  if (count === 0) {
    return null;
  }
  return (
    <span
      className="text-meta text-faint-foreground"
      title="Chat, agent roles and background tasks pinned to this provider in Models"
    >
      {count} pinned
    </span>
  );
};
