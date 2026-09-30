import { useCallback, type RefObject } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { PendingAttachment } from '../../../../../attachments/pendingAttachment';
import { focusComposerTextarea } from '../../focusComposerTextarea';
import type { QueuedTurn } from '../../lib';
import { useMessageQueue } from '../useMessageQueue';
import type { useTurnRouting } from '../useTurnRouting';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly setValue: (next: string) => void;
  readonly setAttachments: (next: ReadonlyArray<PendingAttachment>) => void;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
};

export const useComposerQueue = ({
  sessionId,
  agentId,
  setValue,
  setAttachments,
  routing,
  wrapperRef,
}: Params) => {
  const onEditQueued = useCallback(
    (item: QueuedTurn) => {
      setValue(item.content);
      setAttachments(item.attachments);
      routing.setSelectedProviderState(item.override?.providerId ?? null);
      routing.setSelectedModelState(item.override?.model ?? item.override?.selection?.key ?? null);
      if (item.override?.selection?.effort != null) {
        routing.setEffortState(item.override.selection.effort);
      }
      focusComposerTextarea(wrapperRef);
    },
    [setValue, setAttachments, routing, wrapperRef],
  );

  return useMessageQueue({ sessionId, agentId, onEdit: onEditQueued });
};
