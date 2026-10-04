import { Trail, type TrailSegmentModel } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useMountDiffStats } from '../../../../store';
import { resolveDiffMount } from '../SessionWorkspace/parts/resolveDiffMount';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { DiffStat } from '../DiffStat';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { useTrailMenus } from '../../hooks/useTrailMenus';
import { supportedLens } from '../../supportedLens';

type SessionCrumbsProps = {
  readonly session: Session;
};

export const SessionCrumbs = ({ session }: SessionCrumbsProps) => {
  const sessionId = session.id as SessionId;
  const crumbs = useSessionCrumbs({ session });
  const storedActiveLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens = supportedLens({ lens: storedActiveLens, isBranchless });
  const menus = useTrailMenus({ session, crumbs, activeLens, isBranchless });
  const diffPath = useAppStore((s) =>
    resolveDiffMount({
      mounts: s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY,
      requestedPath: s.diffMountPath?.[sessionId] ?? null,
      fallbackPath: resolveSessionRepo({ state: s, sessionId })?.worktreePath ?? null,
    }),
  );
  const diffStats = useMountDiffStats(sessionId);
  const branchStat = diffPath === null ? null : (diffStats.get(diffPath) ?? null);

  const segments: ReadonlyArray<TrailSegmentModel> = crumbs.map((crumb) => {
    const accessory =
      crumb.id === 'diff-branch' && branchStat !== null ? (
        <DiffStat additions={branchStat.additions} deletions={branchStat.deletions} />
      ) : (
        crumb.accessory
      );
    const menu = menus.get(crumb.id) ?? null;
    return {
      id: crumb.id,
      label: crumb.label,
      icon: crumb.icon,
      ...(crumb.iconClassName !== undefined && { iconClassName: crumb.iconClassName }),
      accessory,
      ...(crumb.onClick !== undefined && { onSelect: crumb.onClick }),
      menu,
      ...((crumb.id === 'diff-branch' || crumb.id === 'pr-number') && { isPinned: true }),
    };
  });

  return <Trail segments={segments} />;
};
