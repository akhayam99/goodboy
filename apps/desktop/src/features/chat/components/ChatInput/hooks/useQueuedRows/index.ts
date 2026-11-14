import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import type { MessageAttachment, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import type { AgentQueuedTurn } from '../../../../../../store/slices/agentQueue/types';
import {
  fromStoredAttachment,
  type PendingAttachment,
} from '../../../../../attachments/pendingAttachment';
import { autoLimitOpenEvent } from '../../../../../auto/chat/autoLimitOpenEvent';
import { useAutoTreeActions } from '../../../../../auto/chat/useAutoTreeActions';
import { flowRulesOf } from '../../../../../work/flowRulesOf';
import { SETTING_WORK_ENABLED } from '../../../../../../shared/lib/workSetting';
import { useAppStore } from '../../../../../../store';
import { readAttachment } from '../../../../turn';
import { focusComposerTextarea } from '../../focusComposerTextarea';
import { directRevealAtOf } from '../../directRevealAtOf';
import { queuedRowsOf, type QueuedRow } from '../../queuedRowsOf';

type Failure = Readonly<{
  title: string;
  message: string;
}>;

type Params = {
  readonly sessionId: SessionId;
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly view: AutoTreeView | null;
  readonly isAgentStopped: boolean;
  readonly editQueued: (id: string) => void;
  readonly removeQueued: (id: string) => void;
  readonly sendQueued: (id: string) => void;
  readonly retryQueued: (id: string) => void;
  readonly setValue: (next: string) => void;
  readonly setAttachments: (next: ReadonlyArray<PendingAttachment>) => void;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
};

export type QueuedRows = Readonly<{
  rows: ReadonlyArray<QueuedRow>;
  failure: Failure | null;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  onSendNow: (id: string) => void;
  onRetry: (id: string) => void;
  onRaiseLimit: (id: string) => void;
}>;

type IdParams = {
  readonly id: string;
};

type RestoreParams = {
  readonly image: MessageAttachment;
};

const restoredImageOf = async ({ image }: RestoreParams): Promise<PendingAttachment> => {
  const dataUrl = await readAttachment(image.dir ?? '', image.relPath);
  if (dataUrl === '') {
    throw new Error(`${image.fileName} couldn't be read`);
  }
  return fromStoredAttachment({
    id: image.id,
    fileName: image.fileName,
    mimeType: image.mimeType,
    dataUrl,
    relPath: image.relPath,
  });
};

type RevealParams = {
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly nowMs: number;
};

const nextRevealOf = ({ queue, nowMs }: RevealParams): number | null =>
  queue.reduce<number | null>((next, turn) => {
    const revealAt = directRevealAtOf({ turn });
    if (revealAt === null || revealAt <= nowMs) {
      return next;
    }
    return next === null ? revealAt : Math.min(next, revealAt);
  }, null);

export const useQueuedRows = ({
  sessionId,
  queue,
  view,
  isAgentStopped,
  editQueued,
  removeQueued,
  sendQueued,
  retryQueued,
  setValue,
  setAttachments,
  wrapperRef,
}: Params): QueuedRows => {
  const actions = useAutoTreeActions({ sessionId });
  const [editFailure, setEditFailure] = useState<Failure | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const nextReveal = nextRevealOf({ queue, nowMs: Math.max(nowMs, Date.now()) });
  useEffect(() => {
    if (nextReveal === null) {
      return;
    }
    const timer = window.setTimeout(() => setNowMs(Date.now()), nextReveal - Date.now());
    return () => window.clearTimeout(timer);
  }, [nextReveal]);
  const isWork = useAppStore((state) => state.settings[SETTING_WORK_ENABLED] === 'true');
  const isAtOnce = flowRulesOf({ isWork }).isMessageDeliveredAtOnce;
  const rows = useMemo(
    () =>
      queuedRowsOf({
        queue,
        view,
        isAgentStopped,
        nowMs: Math.max(nowMs, Date.now()),
        isAtOnce,
      }),
    [queue, view, isAgentStopped, nowMs, isAtOnce],
  );

  const messageOf = useCallback(
    ({ id }: IdParams) => view?.pendingMessages.find((message) => message.rowId === id) ?? null,
    [view],
  );

  const onEdit = useCallback(
    (id: string) => {
      const message = messageOf({ id });
      if (message === null || view === null) {
        editQueued(id);
        return;
      }
      setEditFailure(null);
      void (async () => {
        try {
          const restored = await Promise.all(
            message.images.map((image) => restoredImageOf({ image })),
          );
          const outcome = await actions.withdraw({ view, rowId: id });
          if (outcome !== 'withdrawn') {
            return;
          }
          setValue(message.text);
          setAttachments(restored);
          focusComposerTextarea(wrapperRef);
        } catch (error) {
          setEditFailure({
            title: "Couldn't take the message back",
            message: formatError(error),
          });
        }
      })();
    },
    [actions, editQueued, messageOf, setAttachments, setValue, view, wrapperRef],
  );

  const onRemove = useCallback(
    (id: string) => {
      if (view === null || messageOf({ id }) === null) {
        removeQueued(id);
        return;
      }
      setEditFailure(null);
      void actions.withdraw({ view, rowId: id });
    },
    [actions, messageOf, removeQueued, view],
  );

  const onSendNow = useCallback(
    (id: string) => {
      if (view === null || messageOf({ id }) === null) {
        sendQueued(id);
        return;
      }
      setEditFailure(null);
      void actions.sendNow({ view, rowId: id });
    },
    [actions, messageOf, sendQueued, view],
  );

  const onRetry = useCallback(
    (id: string) => {
      if (view === null || messageOf({ id }) === null) {
        retryQueued(id);
        return;
      }
      setEditFailure(null);
      void actions.retry({ view });
    },
    [actions, messageOf, retryQueued, view],
  );

  const onRaiseLimit = useCallback(() => {
    if (view !== null) {
      window.dispatchEvent(new Event(autoLimitOpenEvent({ treeId: view.tree.id })));
    }
  }, [view]);

  return {
    rows,
    failure: editFailure ?? actions.failure,
    onEdit,
    onRemove,
    onSendNow,
    onRetry,
    onRaiseLimit,
  };
};
