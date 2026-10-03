import { useCallback, useMemo, useState } from 'react';
import type { SessionContextItem, SessionContextItemId } from '@goodboy/types';
import { useAppStore } from '../../../store';

const NONE: ReadonlySet<SessionContextItemId> = new Set();

type Params = {
  readonly items: ReadonlyArray<SessionContextItem>;
};

export type LearningList = {
  readonly visible: ReadonlyArray<SessionContextItem>;
  readonly activeCount: number;
  readonly openId: SessionContextItemId | null;
  readonly toggle: (id: SessionContextItemId) => void;
  readonly dismiss: (id: SessionContextItemId) => void;
  readonly undo: (id: SessionContextItemId) => void;
};

export const useLearningList = ({ items }: Params): LearningList => {
  const setContextItemStatus = useAppStore((state) => state.setContextItemStatus);
  const reportError = useAppStore((state) => state.reportError);
  const [dismissedHere, setDismissedHere] = useState<ReadonlySet<SessionContextItemId>>(NONE);
  const [openId, setOpenId] = useState<SessionContextItemId | null>(null);

  const learnings = useMemo(() => items.filter((item) => item.kind === 'learning'), [items]);
  const visible = useMemo(
    () => learnings.filter((item) => item.status === 'active' || dismissedHere.has(item.id)),
    [dismissedHere, learnings],
  );
  const activeCount = useMemo(
    () => learnings.filter((item) => item.status === 'active').length,
    [learnings],
  );

  const toggle = useCallback(
    (id: SessionContextItemId) => setOpenId((current) => (current === id ? null : id)),
    [],
  );

  const dismiss = useCallback(
    (id: SessionContextItemId) => {
      setDismissedHere((current) => new Set([...current, id]));
      setOpenId((current) => (current === id ? null : current));
      void setContextItemStatus({ id, status: 'dismissed' }).catch((error: unknown) =>
        reportError({ title: "Couldn't dismiss it", error }),
      );
    },
    [reportError, setContextItemStatus],
  );

  const undo = useCallback(
    (id: SessionContextItemId) => {
      void setContextItemStatus({ id, status: 'active' }).catch((error: unknown) =>
        reportError({ title: "Couldn't bring it back", error }),
      );
    },
    [reportError, setContextItemStatus],
  );

  return { visible, activeCount, openId, toggle, dismiss, undo };
};
