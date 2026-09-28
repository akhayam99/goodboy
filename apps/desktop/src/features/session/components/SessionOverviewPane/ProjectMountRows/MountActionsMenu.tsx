import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AnchoredPopover, IconButton, cn, useDropdown, tintClasses } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { useAppStore } from '../../../../../store';
import { worktreeDetachAssessment } from '../../../../worktree/worktree';
import {
  mountCleanupBlockers,
  type MountCleanupBlocker,
} from '../../../../../store/slices/mount-cleanup/cleanupPolicy';
import type { DetachDisposition } from '../../../../../store/slices/project-mounts/detachProject';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { DetachConfirm } from './DetachConfirm';
import {
  BLOCKER_SENTENCE,
  REMOVAL_STAGE,
  buildDetachPlan,
  detachFailureMessage,
  detachOutcomeMessage,
  summarizeDetachOutcomes,
  type MountAssessment,
} from './detachPlan';

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
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-96',
    expectedWidth: 384,
    expectedHeight: 190,
  });
  const detachProject = useAppStore((state) => state.detachProject);
  const reportError = useAppStore((state) => state.reportError);
  const projectKind = useAppStore(
    (state) => state.projects.find((candidate) => candidate.id === projectId)?.kind ?? null,
  );
  const isRepoProject = projectKind === 'repo';
  const projectBaseBranch = useAppStore(
    (state) => state.projects.find((candidate) => candidate.id === projectId)?.baseBranch ?? null,
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
  const label = `${projectName} actions`;

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

  const cancelDetach = () => {
    requestRef.current = requestRef.current + 1;
    setAssessments(null);
    setStage(null);
    setIsConfirming(false);
  };

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    requestRef.current = requestRef.current + 1;
    setIsConfirming(false);
    setAssessments(null);
    setStage(null);
  }, [dropdown.open]);

  const detach = async ({ disposition }: { readonly disposition: DetachDisposition }) => {
    setIsBusy(true);
    setStage(disposition === 'keep-files' ? null : REMOVAL_STAGE);
    try {
      const outcomes = await detachProject({ sessionId, projectId, disposition });
      const summary = summarizeDetachOutcomes({ outcomes });
      const summarized = outcomes.find((outcome) => outcome.kind === summary);
      if (summary === 'failed') {
        fail({
          title: `Couldn't detach ${projectName}`,
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
      dropdown.close();
      setIsConfirming(false);
    } catch (error) {
      fail({ title: "Couldn't detach the project", error });
    } finally {
      setIsBusy(false);
      setStage(null);
    }
  };

  if (detachTargets.length === 0) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      anchorClassName="shrink-0"
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.row}
          label={label}
          onClick={() => {
            if (dropdown.open) {
              dropdown.close();
              setIsConfirming(false);
              return;
            }
            dropdown.toggle();
          }}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          className={cn('size-7', dropdown.open && 'bg-muted')}
        />
      }
    >
      {isConfirming ? (
        <DetachConfirm
          projectName={projectName}
          plan={buildDetachPlan({
            projectName,
            worktreePath,
            isRepoProject,
            blockers,
            assessments,
          })}
          isBusy={isBusy}
          stage={stage}
          onConfirm={({ disposition }) => void detach({ disposition })}
          onRecheck={assess}
          onCancel={cancelDetach}
        />
      ) : null}
      {isConfirming ? null : (
        <div className="flex flex-col">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsConfirming(true);
              assess();
            }}
            className={cn(
              'flex w-full items-center px-2.5 py-1.5 text-left',
              tintClasses('danger').text,
              'motion-safe:transition-colors',
              tintClasses('danger').hoverBg,
              'hover:text-danger',
            )}
          >
            Detach project
          </button>
        </div>
      )}
    </AnchoredPopover>
  );
};
