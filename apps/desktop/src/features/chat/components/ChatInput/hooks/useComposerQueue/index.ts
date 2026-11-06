import { useCallback, type RefObject } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import {
  fromStoredAttachment,
  type PendingAttachment,
} from '../../../../../attachments/pendingAttachment';
import { useAppStore } from '../../../../../../store';
import { autoTreeOfAgent } from '../../../../../auto/autoTreeOfAgent';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import { focusComposerTextarea } from '../../focusComposerTextarea';
import type { QueuedTurn } from '../../lib';
import { useMessageQueue } from '../useMessageQueue';
import { useQueuedRows } from '../useQueuedRows';
import type { useTurnRouting } from '../useTurnRouting';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly setValue: (next: string) => void;
  readonly setAttachments: (next: ReadonlyArray<PendingAttachment>) => void;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
};

export const useComposerQueue = ({
  sessionId,
  agentId,
  views,
  setValue,
  setAttachments,
  routing,
  wrapperRef,
}: Params) => {
  const onEditQueued = useCallback(
    (item: QueuedTurn) => {
      setValue(item.content);
      setAttachments(item.attachments.map(fromStoredAttachment));
      routing.setSelectedProviderState(item.override?.providerId ?? null);
      routing.setSelectedModelState(item.override?.model ?? item.override?.selection?.key ?? null);
      if (item.override?.selection?.effort != null) {
        routing.setEffortState(item.override.selection.effort);
      }
      focusComposerTextarea(wrapperRef);
    },
    [setValue, setAttachments, routing, wrapperRef],
  );

  const {
    queue,
    enqueue,
    sendNow,
    removeQueued,
    sendQueued,
    retryQueued,
    forceQueued,
    editQueued,
  } = useMessageQueue({
    sessionId,
    agentId,
    onEdit: onEditQueued,
  });
  const isAgentStopped = useAppStore((state) =>
    (state.sessionPhaseRuns[sessionId] ?? []).some(
      (agent) => agent.id === agentId && agent.status === 'stopped',
    ),
  );
  const tree = agentId === null ? null : autoTreeOfAgent({ views, agentId });
  const queued = useQueuedRows({
    sessionId,
    queue,
    view: tree?.kind === 'root' ? tree.view : null,
    isAgentStopped,
    editQueued,
    removeQueued,
    sendQueued,
    retryQueued,
    setValue,
    setAttachments,
    wrapperRef,
  });

  const heldId = queue.find((turn) => turn.hold !== undefined)?.id ?? null;
  const sendHeldAnyway = heldId === null ? null : () => forceQueued(heldId);

  return { enqueue, sendNow, queued, sendHeldAnyway };
};
