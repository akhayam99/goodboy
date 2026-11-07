import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
import { useAppStore } from '../../../../../../../store';
import { runGroupFocusOf } from '../../../../../../../store/slices/navigation/runGroupFocusOf';
import type { GroupBy } from '../../../../../../../store/slices/session-grouping/state';
import { useRowReturn } from '../../../../../../../shared/hooks/useRowReturn';
import type { BranchGroup } from '../../../../../branchGroupsOf';
import { VISIBLE_FINISHED_COUNT } from '../../../../../finishedRunsCap';
import type { SessionRun } from '../../../../../sessionRunsOf';
import { archivedFoldKeyOf } from '../branchGroupRunsOf';

type Params = {
  readonly groupBy: GroupBy;
  readonly runs: ReadonlyArray<SessionRun>;
  readonly branchGroups: ReadonlyArray<BranchGroup>;
};

type GroupParams = {
  readonly key: string;
};

type RevealParams = {
  readonly run: SessionRun;
  readonly fromGroupKey: string;
};

type ReturnFoldParams = {
  readonly groupBy: GroupBy;
  readonly returnRowId: string | null;
  readonly branchGroups: ReadonlyArray<BranchGroup>;
};

const foldKeyOfReturnRow = ({
  groupBy,
  returnRowId,
  branchGroups,
}: ReturnFoldParams): string | undefined => {
  if (groupBy !== 'branch' || returnRowId === null) {
    return undefined;
  }
  for (const group of branchGroups) {
    const run = group.runs.find((candidate) => `${group.key}/${candidate.id}` === returnRowId);
    if (run === undefined) {
      continue;
    }
    if (run.isArchived) {
      return archivedFoldKeyOf({ groupKey: group.key });
    }
    return run.isFinished ? group.key : undefined;
  }
  return undefined;
};

export const useRunsFolds = ({ groupBy, runs, branchGroups }: Params) => {
  const [isEarlierShown, setIsEarlierShown] = useState(false);
  const [isArchivedShown, setIsArchivedShown] = useState(false);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [revealRowKey, setRevealRowKey] = useState<string | null>(null);
  const finished = useMemo(() => runs.filter((run) => run.isFinished && !run.isArchived), [runs]);
  const archived = runs.filter((run) => run.isArchived);
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
  const isReturnArchived =
    groupBy === 'state' && returnRowId !== null && archived.some((run) => run.id === returnRowId);
  const foldKeyOfReturn = foldKeyOfReturnRow({ groupBy, returnRowId, branchGroups });
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
    if (isReturnArchived) {
      unfoldedFor.current = returnRowId;
      setIsArchivedShown(true);
    }
    if (foldKeyOfReturn !== undefined) {
      unfoldedFor.current = returnRowId;
      setOpenGroups((open) => new Set([...open, foldKeyOfReturn]));
    }
  }, [returnRowId, isReturnEarlier, isReturnArchived, foldKeyOfReturn]);

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
    if (groupBy === 'state') {
      if (finished.slice(VISIBLE_FINISHED_COUNT).some((run) => group.runs.includes(run))) {
        setIsEarlierShown(true);
      }
      if (group.runs.some((run) => run.isArchived)) {
        setIsArchivedShown(true);
      }
    }
    if (groupBy === 'branch') {
      setOpenGroups(
        (open) =>
          new Set([...open, arrivedGroupKey, archivedFoldKeyOf({ groupKey: arrivedGroupKey })]),
      );
    }
    if (returnRowId !== null) {
      return;
    }
    const firstRun = group.runs[0];
    if (firstRun !== undefined) {
      setRevealRowKey(groupBy === 'branch' ? `${arrivedGroupKey}/${firstRun.id}` : firstRun.id);
    }
  }, [arrivedGroupKey, groupBy, branchGroups, returnRowId, finished]);

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
    setOpenGroups((open) => new Set([...open, groupKey, archivedFoldKeyOf({ groupKey })]));
    setRevealRowKey(`${groupKey}/${run.id}`);
  };

  return {
    rowReturn,
    isEarlierShown,
    isArchivedShown,
    openGroups,
    toggleGroup,
    toggleEarlier: () => setIsEarlierShown((isShown) => !isShown),
    toggleArchived: () => setIsArchivedShown((isShown) => !isShown),
    revealRun,
  };
};
