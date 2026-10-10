import { useEffect, useMemo, useRef, useState } from 'react';
import { Unlink } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { IconButton } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import { worktreeDetachAssessment } from '../../../../worktree/worktree';
import {
  mountCleanupBlockers,
  type MountCleanupBlocker,
} from '../../../../../store/slices/mount-cleanup/cleanupPolicy';
import type { DetachDisposition } from '../../../../../store/slices/project-mounts/detachProject';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../shared/names';
import {
  PROJECT_DETACH_EVENT,
  projectKeyOf,
  type ProjectDetachRequest,
} from '../../../../actions/kinds/project';
import { DetachConfirm } from './DetachConfirm';
import {
  REMOVAL_STAGE,
  buildDetachPlan,
  detachFailureMessage,
  detachOutcomeMessage,
  summarizeDetachOutcomes,
  type MountAssessment,
} from './detachPlan';
import { projectById } from '../../../../../store/slices/projects/projectIndex';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId | undefined;
  readonly projectName: string;
  readonly worktreePath: string;
};

type DetachTarget = {
  readonly mountId: MountId;
  readonly path: string;
  readonly branch: string;
  readonly baseBranch: string | null;
  readonly isOnDisk: boolean;
};

const isDetachRequest = (event: Event): event is CustomEvent<ProjectDetachRequest> =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'projectKey' in event.detail;

const BLOCKER_CODES = [
  'agent-running',
  'terminal-open',
] satisfies ReadonlyArray<MountCleanupBlocker>;

export const MountActionsMenu = ({
  sessionId,
  projectId,
  workspaceId,
  projectName,
  worktreePath,
}: Props) => {
  const projectKey = projectKeyOf({ sessionId, projectId });
  const detachProject = useAppStore((state) => state.detachProject);
  const reportError = useAppStore((state) => state.reportError);
  const projectKind = useAppStore((state) => projectById(state.projects, projectId)?.kind ?? null);
  const isRepoProject = projectKind === 'repo';
  const projectBaseBranch = useAppStore(
    (state) => projectById(state.projects, projectId)?.baseBranch ?? null,
  );
  const mountViews = useAppStore(
    useShallow((state) =>
      (state.sessionMounts?.[sessionId] ?? []).filter((view) => view.projectId === projectId),
    ),
  );
  const detachTargets = useMemo<ReadonlyArray<DetachTarget>>(
    () =>
      mountViews.map((view) => ({
        mountId: view.id,
        path: view.worktreePath ?? view.lastWorktreePath ?? '',
        branch: view.branch,
        baseBranch: view.baseBranch,
        isOnDisk: view.diskState !== 'missing' && view.diskState !== 'removed',
      })),
    [mountViews],
  );
  const blockerKey = useAppStore((state) =>
    [
      ...new Set(
        detachTargets.flatMap((target) =>
          mountCleanupBlockers({
            state,
            sessionId,
            mountId: target.mountId,
            worktreePath: target.path,
          }),
        ),
      ),
    ]
      .sort()
      .join(','),
  );
  const blockers = BLOCKER_CODES.filter((code) => blockerKey.split(',').includes(code));
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<ReadonlyArray<MountAssessment> | null>(null);
  const requestRef = useRef(0);

  const fail = ({ title, error }: { title: string; error: unknown }) => {
    void reportError({
      title,
      error,
      severity: 'warning',
      sessionId,
      ...(workspaceId !== undefined && { workspaceId }),
    });
  };

  const assess = () => {
    const token = requestRef.current + 1;
    requestRef.current = token;
    setAssessments(null);
    if (!isRepoProject || blockers.length > 0) {
      return;
    }
    void Promise.all(
      detachTargets.map(async (target): Promise<MountAssessment> => {
        const unavailable = {
          worktreePath: target.path,
          branch: target.branch,
          assessment: { kind: 'unavailable', path: target.path, branch: null },
        } satisfies MountAssessment;
        if (target.path === '' || !target.isOnDisk) {
          return {
            worktreePath: target.path,
            branch: target.branch,
            assessment: { kind: 'missing', path: target.path },
          };
        }
        try {
          return {
            worktreePath: target.path,
            branch: target.branch,
            assessment: await worktreeDetachAssessment({
              worktreePath: target.path,
              baseBranch: target.baseBranch ?? projectBaseBranch,
            }),
          };
        } catch {
          return unavailable;
        }
      }),
    ).then((results) => {
      if (requestRef.current !== token) {
        return;
      }
      setAssessments(results);
    });
  };

  const assessRef = useRef(assess);
  assessRef.current = assess;

  useEffect(() => {
    const onRequest = (event: Event) => {
      if (!isDetachRequest(event) || event.detail.projectKey !== projectKey) {
        return;
      }
      setIsConfirming(true);
      assessRef.current();
    };
    window.addEventListener(PROJECT_DETACH_EVENT, onRequest);
    return () => window.removeEventListener(PROJECT_DETACH_EVENT, onRequest);
  }, [projectKey]);

  const cancelDetach = () => {
    requestRef.current = requestRef.current + 1;
    setAssessments(null);
    setStage(null);
    setIsConfirming(false);
  };

  const detach = async ({ disposition }: { readonly disposition: DetachDisposition }) => {
    setIsBusy(true);
    setStage(disposition === 'keep-files' ? null : REMOVAL_STAGE);
    try {
      const outcomes = await detachProject({ sessionId, projectId, disposition });
      const summary = summarizeDetachOutcomes({ outcomes });
      const summarized = outcomes.find((outcome) => outcome.kind === summary);
      if (summary === 'failed') {
        fail({
          title: `Couldn't remove ${projectName} from the session`,
          error: detachFailureMessage({ outcomes }),
        });
        assess();
        return;
      }
      showToast({
        kind: 'info',
        message: detachOutcomeMessage({
          kind: summary,
          projectName,
          worktreePath: summarized?.worktreePath ?? worktreePath,
        }),
      });
      setIsConfirming(false);
    } catch (error) {
      fail({ title: "Couldn't remove the project from the session", error });
    } finally {
      setIsBusy(false);
      setStage(null);
    }
  };

  if (detachTargets.length === 0) {
    return null;
  }

  return (
    <DetachConfirm
      projectName={projectName}
      plan={buildDetachPlan({
        projectName,
        worktreePath,
        isRepoProject,
        blockers,
        assessments,
      })}
      isOpen={isConfirming}
      isBusy={isBusy}
      stage={stage}
      onConfirm={({ disposition }) => void detach({ disposition })}
      onRecheck={assess}
      onCancel={cancelDetach}
      trigger={() => (
        <IconButton
          size="xs"
          variant="ghost"
          icon={Unlink}
          iconSize={ICON_SIZE.row}
          label={`${NAMES.removeFromSession} for ${projectName}`}
          tooltip={NAMES.removeFromSession}
          aria-haspopup="dialog"
          onClick={() => {
            setIsConfirming(true);
            assess();
          }}
        />
      )}
    />
  );
};
