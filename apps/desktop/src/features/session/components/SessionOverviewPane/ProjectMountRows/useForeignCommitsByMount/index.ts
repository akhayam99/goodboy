import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { remoteBranchState, type RemoteBranchState } from '../../../../../worktree/worktree';
import { isForeignCommitCandidate } from '../foreignCommits';

type StatusParams = {
  readonly row: MountRowView;
};

type Params = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statusOf: (params: StatusParams) => WorktreeStatus | null;
};

type Found = {
  readonly key: string;
  readonly state: RemoteBranchState;
};

type Candidate = {
  readonly row: MountRowView;
  readonly key: string;
};

type FoundMap = ReadonlyMap<string, Found>;

type SettleParams = {
  readonly mountId: string;
  readonly found: Found | null;
};

const NO_STATES: ReadonlyMap<string, RemoteBranchState> = new Map();

const settled =
  ({ mountId, found }: SettleParams) =>
  (current: FoundMap): FoundMap => {
    const next = new Map(current);
    if (found === null) {
      next.delete(mountId);
      return next;
    }
    next.set(mountId, found);
    return next;
  };

export const useForeignCommitsByMount = ({
  rows,
  statusOf,
}: Params): ReadonlyMap<string, RemoteBranchState> => {
  const [found, setFound] = useState<FoundMap>(new Map());
  const candidates = useMemo(
    () =>
      rows.flatMap((row): ReadonlyArray<Candidate> => {
        const status = statusOf({ row });
        return isForeignCommitCandidate({ row, status })
          ? [
              {
                row,
                key: `${row.mountId}:${row.branch}:${row.baseBranch ?? ''}:${status?.head ?? ''}`,
              },
            ]
          : [];
      }),
    [rows, statusOf],
  );

  const candidatesRef = useRef(candidates);
  const probeKey = candidates.map(({ row, key }) => `${key}@${row.repoRoot}`).join('\n');

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

  useEffect(() => {
    let isStale = false;
    for (const { row, key } of candidatesRef.current) {
      remoteBranchState({ repoPath: row.repoRoot, branch: row.branch, base: row.baseBranch })
        .then((state) => {
          if (isStale) {
            return;
          }
          const isStranded =
            state !== null &&
            state.remoteAhead > 0 &&
            state.localOwn === 0 &&
            state.remoteContainsLocal;
          setFound(settled({ mountId: row.mountId, found: isStranded ? { key, state } : null }));
        })
        .catch(() => {
          if (!isStale) {
            setFound(settled({ mountId: row.mountId, found: null }));
          }
        });
    }
    return () => {
      isStale = true;
    };
  }, [probeKey]);

  return useMemo(() => {
    const live = new Map(
      candidates.flatMap(({ row, key }): ReadonlyArray<readonly [string, RemoteBranchState]> => {
        const entry = found.get(row.mountId);
        return entry !== undefined && entry.key === key ? [[row.mountId, entry.state]] : [];
      }),
    );
    return live.size === 0 ? NO_STATES : live;
  }, [candidates, found]);
};
