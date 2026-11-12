import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
import { useAppStore } from '../../../../../../../store';
import { runGroupFocusOf } from '../../../../../../../store/slices/navigation/runGroupFocusOf';
import type { GroupBy } from '../../../../../../../store/slices/session-grouping/state';
import { useRowReturn } from '../../../../../../../shared/hooks/useRowReturn';
import type { BranchGroupOrder } from '../../../../../branchGroupOrderOf';
import { VISIBLE_FINISHED_COUNT } from '../../../../../finishedRunsCap';
import type { SessionRun } from '../../../../../sessionRunsOf';
import { FINISHED_FOLD_KEY } from '../finishedFoldKey';
import { returnFoldKeyOf } from '../returnFoldKeyOf';

type Params = {
  readonly groupBy: GroupBy;
  readonly runs: ReadonlyArray<SessionRun>;
  readonly branchOrder: BranchGroupOrder;
};

type GroupParams = {
  readonly key: string;
};

type RevealParams = {
  readonly run: SessionRun;
  readonly fromGroupKey: string;
};

type FoldKeysParams = {
  readonly groupKey: string;
  readonly finishedKeys: ReadonlySet<string>;
};

const foldKeysOf = ({ groupKey, finishedKeys }: FoldKeysParams): ReadonlyArray<string> =>
  finishedKeys.has(groupKey) ? [groupKey, FINISHED_FOLD_KEY] : [groupKey];

export const useRunsFolds = ({ groupBy, runs, branchOrder }: Params) => {
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [revealRowKey, setRevealRowKey] = useState<string | null>(null);
  const branchGroups = useMemo(
    () => [...branchOrder.shown, ...branchOrder.finished],
    [branchOrder],
  );
  const finishedKeys = useMemo(
    () => new Set(branchOrder.finished.map((group) => group.key)),
    [branchOrder],
  );
  const finished = useMemo(() => runs.filter((run) => run.isFinished), [runs]);
  const rowIds = useMemo(
    () =>
      groupBy === 'branch'
        ? branchGroups.flatMap((group) => group.runs.map((run) => `${group.key}/${run.id}`))
        : runs.map((run) => run.id),
    [groupBy, branchGroups, runs],
  );
  const rowReturn = useRowReturn({ listKey: 'runs', rowIds, rowAttribute: 'data-row-key' });
  const { returnRowId } = rowReturn;
  const isReturnEarlier =
    groupBy === 'state' &&
    returnRowId !== null &&
    finished.slice(VISIBLE_FINISHED_COUNT).some((run) => run.id === returnRowId);
  const returnGroupKey =
    groupBy === 'branch' && returnRowId !== null
      ? (branchGroups.find((group) =>
          group.runs.some((run) => `${group.key}/${run.id}` === returnRowId),
        )?.key ?? null)
      : null;
  const foldKeyOfReturn = returnFoldKeyOf({
    returnRowId: groupBy === 'branch' ? returnRowId : null,
    branchGroups,
  });
  const isReturnInFinished = returnGroupKey !== null && finishedKeys.has(returnGroupKey);
  const unfoldedFor = useRef<string | null>(null);
  const arrivedGroupKey = useAppStore((state) => runGroupFocusOf({ state })?.groupKey ?? null);
  const revealedArrival = useRef<string | null>(null);

  useEffect(() => {
    if (returnRowId === null || unfoldedFor.current === returnRowId) {
      return;
    }
    if (isReturnEarlier) {
      unfoldedFor.current = returnRowId;
      setIsEarlierShown(true);
    }
    const keys = [
      ...(foldKeyOfReturn === undefined ? [] : [foldKeyOfReturn]),
      ...(isReturnInFinished ? [FINISHED_FOLD_KEY] : []),
    ];
    if (keys.length > 0) {
      unfoldedFor.current = returnRowId;
      setOpenGroups((open) => new Set([...open, ...keys]));
    }
  }, [returnRowId, isReturnEarlier, foldKeyOfReturn, isReturnInFinished]);

  useEffect(() => {
    if (revealRowKey === null) {
      return;
    }
    const row = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(revealRowKey)}"]`);
    if (row === null) {
      return;
    }
    setRevealRowKey(null);
    appScrollIntoView({ element: row, block: 'center' });
    row.focus();
  }, [revealRowKey]);

  useEffect(() => {
    if (arrivedGroupKey === null) {
      revealedArrival.current = null;
      return;
    }
    const arrivalKey = `${groupBy}/${arrivedGroupKey}`;
    if (revealedArrival.current === arrivalKey) {
      return;
    }
    const group = branchGroups.find((candidate) => candidate.key === arrivedGroupKey);
    if (group === undefined) {
      return;
    }
    revealedArrival.current = arrivalKey;
    if (
      groupBy === 'state' &&
      finished.slice(VISIBLE_FINISHED_COUNT).some((run) => group.runs.includes(run))
    ) {
      setIsEarlierShown(true);
    }
    if (groupBy === 'branch') {
      setOpenGroups(
        (open) => new Set([...open, ...foldKeysOf({ groupKey: arrivedGroupKey, finishedKeys })]),
      );
    }
    if (returnRowId !== null) {
      return;
    }
    const firstRun = group.runs[0];
    if (firstRun !== undefined) {
      setRevealRowKey(groupBy === 'branch' ? `${arrivedGroupKey}/${firstRun.id}` : firstRun.id);
    }
  }, [arrivedGroupKey, groupBy, branchGroups, finishedKeys, returnRowId, finished]);

  const toggleGroup = useCallback(({ key }: GroupParams) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      next.delete(key);
      return open.has(key) ? next : new Set([...open, key]);
    });
  }, []);

  const revealRun = ({ run, fromGroupKey }: RevealParams) => {
    const groupKeys = branchGroups
      .filter((group) => group.runs.some((candidate) => candidate.id === run.id))
      .map((group) => group.key);
    const nextIndex = (groupKeys.indexOf(fromGroupKey) + 1) % groupKeys.length;
    const groupKey = groupKeys[nextIndex];
    if (groupKey === undefined || groupKey === fromGroupKey) {
      return;
    }
    setOpenGroups((open) => new Set([...open, ...foldKeysOf({ groupKey, finishedKeys })]));
    setRevealRowKey(`${groupKey}/${run.id}`);
  };

  return {
    rowReturn,
    isEarlierShown,
    openGroups,
    toggleGroup,
    toggleEarlier: () => setIsEarlierShown((isShown) => !isShown),
    revealRun,
  };
};
