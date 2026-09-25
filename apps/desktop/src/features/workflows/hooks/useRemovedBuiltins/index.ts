import { useEffect, useState } from 'react';
import { listRemovedSeededWorkflowIds } from '@goodboy/db';
import type { Workflow, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

const EMPTY_IDS: ReadonlySet<string> = new Set();

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workflows: ReadonlyArray<Workflow>;
};

export const useRemovedBuiltins = ({ workspaceId, workflows }: Params): ReadonlySet<string> => {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(EMPTY_IDS);

  useEffect(() => {
    let cancelled = false;
    listRemovedSeededWorkflowIds(tauriDatabase, workspaceId)
      .then(
        (ids) => new Set<string>(ids),
        () => EMPTY_IDS,
      )
      .then((ids) => {
        if (!cancelled) {
          setRemovedIds(ids);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, workflows]);

  return removedIds;
};
