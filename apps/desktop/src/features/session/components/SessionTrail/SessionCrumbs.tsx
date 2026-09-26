import { StatusDot, Tooltip, Trail, type TrailSegmentModel } from '@goodboy/ui';
import type { Agent, AgentId, Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useMountDiffStats,
  useSessionStageInfo,
} from '../../../../store';
import { resolveDiffMount } from '../SessionWorkspace/parts/resolveDiffMount';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { DiffStat } from '../DiffStat';
import { describeSessionStage } from '../../session-stage';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { useTrailMenus } from '../../hooks/useTrailMenus';
import { supportedLens } from '../../supportedLens';
import { AgentStatusIcon } from '../AgentCard/AgentStatusIcon';

type SessionCrumbsProps = {
  readonly session: Session;
};

export const SessionCrumbs = ({ session }: SessionCrumbsProps) => {
  const sessionId = session.id as SessionId;
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);
  const stagePresentation = describeSessionStage(stage);
  const selectedAgentId = useAppStore(
    (state) => state.selectedAgentId[sessionId] ?? null,
  ) as AgentId | null;
  const storedActiveLens = useAppStore((state) => state.activeLens[sessionId] ?? null);
  const isBranchless = useIsBranchlessSession({ session });
  const activeLens = supportedLens({ lens: storedActiveLens, isBranchless });
  const selectedAgent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>)).find(
        (agent) => agent.id === selectedAgentId,
      ) ?? null,
  );
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

  const segments: ReadonlyArray<TrailSegmentModel> = crumbs.map((crumb, index) => {
    const isLast = index === crumbs.length - 1;
    const accessory =
      isLast && crumb.id === 'selected-child' && selectedAgent != null ? (
        <AgentStatusIcon status={selectedAgent.status} />
      ) : crumb.id === 'diff-branch' && branchStat !== null ? (
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
      ...(crumb.id === 'diff-branch' && { isPinned: true }),
    };
  });

  return (
    <Trail
      segments={segments}
      lead={
        <Tooltip content={stateDescription({ presentation: stagePresentation })}>
          <span className="inline-flex shrink-0 items-center">
            <StatusDot
              tone={stagePresentation.tone}
              size="sm"
              ariaLabel={stateDescription({ presentation: stagePresentation })}
            />
          </span>
        </Tooltip>
      }
    />
  );
};
