import { useCallback, useEffect, useMemo } from 'react';
import type { StarredIssue, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { starIdentityOf, starKey } from '../../integrations/starred/starredIssueOf';
import type { InboxRecord } from '../types';
import { compareIsoDesc } from '../../../shared/utils/compareIsoDesc';

export type StarredRow = {
  readonly issue: StarredIssue;
  readonly record: InboxRecord | null;
};

const EMPTY_RECORDS: Readonly<Record<string, InboxRecord>> = {};

const recordStarKey = (record: InboxRecord): string | null => {
  const identity = starIdentityOf(record);
  return identity === null ? null : starKey(identity);
};

const rank = (row: StarredRow): number => (row.issue.state === 'done' ? 1 : 0);

const updatedAtOf = (row: StarredRow): string =>
  row.record?.updatedAt ?? row.issue.refreshedAt ?? row.issue.starredAt;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly records: ReadonlyArray<InboxRecord>;
  readonly refreshOnOpen?: boolean;
};

export const useInboxStars = ({ workspaceId, records, refreshOnOpen = true }: Params) => {
  const starred = useAppStore(
    (state) => state.starredIssues[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<StarredIssue>),
  );
  const fresh = useAppStore((state) => state.starredRecords[workspaceId] ?? EMPTY_RECORDS);
  const loadStarredIssues = useAppStore((state) => state.loadStarredIssues);
  const refreshStarredIssues = useAppStore((state) => state.refreshStarredIssues);
  const starIssueRecord = useAppStore((state) => state.starIssueRecord);
  const unstarIssue = useAppStore((state) => state.unstarIssue);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    void loadStarredIssues({ workspaceId })
      .then(() => (refreshOnOpen ? refreshStarredIssues({ workspaceId }) : undefined))
      .catch(() => undefined);
  }, [workspaceId, refreshOnOpen, loadStarredIssues, refreshStarredIssues]);

  const loadedByKey = useMemo(() => {
    const byKey = new Map<string, InboxRecord>();
    for (const record of records) {
      const key = recordStarKey(record);
      if (key !== null) {
        byKey.set(key, record);
      }
    }
    return byKey;
  }, [records]);

  const starredKeys = useMemo(() => new Set(starred.map((issue) => starKey(issue))), [starred]);

  const rows: ReadonlyArray<StarredRow> = useMemo(
    () =>
      starred
        .map((issue) => {
          const key = starKey(issue);
          return { issue, record: loadedByKey.get(key) ?? fresh[key] ?? null };
        })
        .sort(
          (left, right) =>
            rank(left) - rank(right) ||
            compareIsoDesc({ left: updatedAtOf(left), right: updatedAtOf(right) }),
        ),
    [starred, loadedByKey, fresh],
  );

  const isStarred = useCallback(
    (record: InboxRecord): boolean => {
      const key = recordStarKey(record);
      return key !== null && starredKeys.has(key);
    },
    [starredKeys],
  );

  const canStar = useCallback((record: InboxRecord): boolean => recordStarKey(record) !== null, []);

  const toggle = useCallback(
    async (record: InboxRecord): Promise<void> => {
      const identity = starIdentityOf(record);
      if (identity === null) {
        return;
      }
      try {
        if (starredKeys.has(starKey(identity))) {
          await unstarIssue({
            workspaceId,
            provider: identity.provider,
            externalId: identity.externalId,
          });
          return;
        }
        await starIssueRecord({ workspaceId, record });
      } catch (error) {
        void reportError({ title: `Couldn't update the star on ${record.identifier}`, error });
      }
    },
    [reportError, starIssueRecord, starredKeys, unstarIssue, workspaceId],
  );

  return { rows, isStarred, canStar, toggle };
};
