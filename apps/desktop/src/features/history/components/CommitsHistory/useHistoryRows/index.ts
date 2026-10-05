import { useMemo } from 'react';
import type { RefObject } from 'react';
import type { BranchCommit, HistoryStep } from '@goodboy/types';
import { useFlipList } from '../../../../../shared/hooks/useFlipList';
import { planOrder } from '../../../historyPlan';
import { useRowPositions } from '../../../useRowPositions';
import type { HistoryRowView } from '../historyRowLine';

const FLIP_ROW_LIMIT = 60;

type Params = {
  readonly view: HistoryRowView;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly commitBySha: ReadonlyMap<string, BranchCommit>;
  readonly listRef: RefObject<HTMLElement | null>;
  readonly editingSha: string | null;
  readonly expanded: ReadonlySet<string>;
  readonly stageWidth: number | null;
  readonly editCount: number;
};

export const useHistoryRows = ({
  view,
  commits,
  items,
  commitBySha,
  listRef,
  editingSha,
  expanded,
  stageWidth,
  editCount,
}: Params) => {
  const rows = useMemo(() => {
    if (view !== 'planned') {
      return commits;
    }
    return [...planOrder({ items })].reverse().flatMap((sha) => {
      const commit = commitBySha.get(sha);
      return commit === undefined ? [] : [commit];
    });
  }, [commitBySha, commits, items, view]);
  const orderKey = rows.map((commit) => commit.sha).join(',');
  const positions = useRowPositions({
    listRef,
    layoutKey: `${orderKey}|${view}|${editingSha ?? ''}|${[...expanded].join(',')}|${stageWidth ?? 0}|${editCount}`,
  });
  useFlipList({
    containerRef: listRef,
    orderKey: `${view}:${orderKey}`,
    isEnabled: rows.length <= FLIP_ROW_LIMIT,
  });
  return { rows, positions };
};
