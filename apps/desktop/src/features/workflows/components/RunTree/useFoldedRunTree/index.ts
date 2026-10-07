import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentId } from '@goodboy/types';
import { layoutTimelineRail } from '../../../../workTreeModel/railGeometry';
import { foldSettledSets } from '../foldSettledSets';
import type { RunTreeModel } from '../useRunTree';

const NO_IDS: ReadonlySet<string> = new Set();

const ID_SEPARATOR = '\u0000';

type SetParams = {
  readonly id: string;
  readonly isExpanded: boolean;
};

export type RunTreeFolds = {
  readonly childIdsBySetId: ReadonlyMap<string, ReadonlyArray<AgentId>>;
  readonly onSet: (params: SetParams) => void;
};

export type FoldedRunTree = {
  readonly tree: RunTreeModel;
  readonly folds: RunTreeFolds;
};

type Params = {
  readonly tree: RunTreeModel | null;
};

export const useFoldedRunTree = ({ tree }: Params): FoldedRunTree | null => {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(NO_IDS);

  const folded = useMemo(
    () =>
      tree === null
        ? null
        : foldSettledSets({ items: tree.stream.items, groups: tree.stream.groups, openIds }),
    [openIds, tree],
  );

  const liveKey = folded === null ? '' : folded.liveSetIds.join(ID_SEPARATOR);

  useEffect(() => {
    if (liveKey === '') {
      return;
    }
    const liveIds = liveKey.split(ID_SEPARATOR);
    setOpenIds((current) =>
      liveIds.every((id) => current.has(id)) ? current : new Set([...current, ...liveIds]),
    );
  }, [liveKey]);

  const onSet = useCallback(({ id, isExpanded }: SetParams) => {
    setOpenIds((current) => {
      if (current.has(id) === isExpanded) {
        return current;
      }
      const next = new Set(current);
      if (isExpanded) {
        next.add(id);
        return next;
      }
      next.delete(id);
      return next;
    });
  }, []);

  return useMemo(() => {
    if (tree === null || folded === null) {
      return null;
    }
    const stream = { items: folded.items, groups: folded.groups };
    const layout = layoutTimelineRail({
      rows: stream.items,
      groups: stream.groups,
      hasSpine: false,
    });
    return {
      tree: { stream, rail: { ...layout, width: tree.rail.width } },
      folds: { childIdsBySetId: folded.childIdsBySetId, onSet },
    };
  }, [folded, onSet, tree]);
};
