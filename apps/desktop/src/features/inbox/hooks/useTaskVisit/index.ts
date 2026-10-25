import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useIsWindowFocused } from '../../../../shared/hooks/useIsWindowFocused';
import { useAppStore } from '../../../../store';
import { EMPTY_TASK_ARRIVALS, arrivedKeysOf } from '../../taskArrivals';
import { readTaskArrivals } from '../../taskArrivalsStorage';
import type { InboxRecord } from '../../types';

const SEEN_AFTER_MS = 3_000;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly records: ReadonlyArray<Pick<InboxRecord, 'key'>>;
};

type Result = {
  readonly newKeys: ReadonlySet<string>;
};

type VisitParams = {
  readonly workspaceId: WorkspaceId;
};

const visitStartOf = ({ workspaceId }: VisitParams): number | null =>
  useAppStore.getState().taskArrivals[workspaceId]?.seenAt ??
  readTaskArrivals({ workspaceId }).seenAt;

export const useTaskVisit = ({ workspaceId, records }: Params): Result => {
  const [visit, setVisit] = useState(() => ({ workspaceId, since: visitStartOf({ workspaceId }) }));
  if (visit.workspaceId !== workspaceId) {
    setVisit({ workspaceId, since: visitStartOf({ workspaceId }) });
  }
  const arrivals = useAppStore((state) => state.taskArrivals[workspaceId]);
  const markTasksSeen = useAppStore((state) => state.markTasksSeen);
  const isInFront = useIsWindowFocused();
  const signature = records.map((record) => record.key).join('\n');
  const keys = useMemo(() => (signature === '' ? [] : signature.split('\n')), [signature]);
  const newKeys = useMemo(
    () =>
      new Set(
        arrivedKeysOf({ arrivals: arrivals ?? EMPTY_TASK_ARRIVALS, keys, since: visit.since }),
      ),
    [arrivals, keys, visit.since],
  );

  useEffect(() => {
    if (!isInFront) {
      return;
    }
    const timer = setTimeout(() => {
      markTasksSeen({ workspaceId });
    }, SEEN_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isInFront, keys, markTasksSeen, workspaceId]);

  return { newKeys };
};
