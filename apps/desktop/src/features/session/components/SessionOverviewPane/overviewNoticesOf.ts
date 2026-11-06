import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { buildBranchDecision } from './ProjectMountRows/branchDecision';
import { mismatchDismissalKeyOf } from './mismatchDismissalKeyOf';

type OverviewNoticeKind = 'mismatch' | 'foreign' | 'publish';

export type OverviewNotice = Readonly<{
  id: string;
  kind: OverviewNoticeKind;
}>;

type StatusParams = {
  readonly row: MountRowView;
};

type Params = {
  readonly rows: ReadonlyArray<MountRowView>;
  readonly statusOf: (params: StatusParams) => WorktreeStatus | null;
  readonly foreignMountIds: ReadonlySet<string>;
  readonly dismissedKeys: ReadonlySet<string>;
  readonly isPublishShown: boolean;
};

const PUBLISH_ID = 'publish';

export const overviewNoticesOf = ({
  rows,
  statusOf,
  foreignMountIds,
  dismissedKeys,
  isPublishShown,
}: Params): ReadonlyArray<OverviewNotice> => {
  const own = rows.flatMap((row): ReadonlyArray<OverviewNotice> => {
    const hasTools = row.projectKind === 'repo' && row.isAttached && row.worktreePath !== null;
    if (hasTools && statusOf({ row })?.inProgress === 'rebase') {
      return [];
    }
    const isMismatch =
      row.observation !== null &&
      !dismissedKeys.has(mismatchDismissalKeyOf({ observation: row.observation })) &&
      buildBranchDecision({
        observation: row.observation,
        projectName: row.projectName,
        holder: null,
      }) !== null;
    return [
      ...(isMismatch ? [{ id: `mismatch:${row.mountId}`, kind: 'mismatch' as const }] : []),
      ...(hasTools && foreignMountIds.has(row.mountId)
        ? [{ id: `foreign:${row.mountId}`, kind: 'foreign' as const }]
        : []),
    ];
  });
  const publish = isPublishShown ? [{ id: PUBLISH_ID, kind: 'publish' as const }] : [];
  return [...publish, ...own];
};
