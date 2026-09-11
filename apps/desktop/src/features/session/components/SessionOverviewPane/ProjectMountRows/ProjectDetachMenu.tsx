import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AnchoredPopover, Button, IconButton, cn, formatError, useDropdown } from '@goodboy/ui';
import type {
  MountId,
  ProjectId,
  SessionId,
  SessionMountView,
  WorktreeStatus,
  WorkspaceId,
} from '@goodboy/types';
import { useToast } from '../../../../../app/components/Toast';
import { useAppStore } from '../../../../../store';
import { isWorkingTreeClean } from '../../../../../shared/lib/gitStatus';
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
  readonly worktreeStatus: WorktreeStatus | null;
  readonly triggerClassName?: string;
  readonly mountId?: MountId;
  readonly branch?: string;
  readonly menuLabel?: string;
  readonly canDetachProject?: boolean;
  readonly isMountAttached?: boolean;
};

type Confirming = 'detach' | 'forget' | 'unmount' | null;

type DetachTarget = {
  readonly mountId: MountId;
  readonly path: string;
  readonly branch: string;
  readonly baseBranch: string | null;
  readonly isOnDisk: boolean;
};

type KeptPathParams = {
  readonly view: SessionMountView | null;
  readonly fallback: string;
};

const keptPathOf = ({ view, fallback }: KeptPathParams): string | null => {
  if (view === null) {
    return fallback === '' ? null : fallback;
  }
  if (view.diskState === 'missing' || view.diskState === 'removed') {
    return null;
  }
  return view.lastWorktreePath;
};

const BLOCKER_CODES = [
  'agent-running',
  'terminal-open',
] satisfies ReadonlyArray<MountCleanupBlocker>;

export const ProjectDetachMenu = ({
  sessionId,
  projectId,
  workspaceId,
  projectName,
  worktreePath,
  worktreeStatus,
  triggerClassName,
  mountId,
  branch = '',
  menuLabel,
  canDetachProject = true,
  isMountAttached,
}: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'w-80', expectedHeight: 190 });
  const detachProject = useAppStore((state) => state.detachProject);
  const unmountMount = useAppStore((state) => state.unmountMount);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const isRepoProject = useAppStore(
    (state) => state.projects.find((candidate) => candidate.id === projectId)?.kind === 'repo',
  );
  const projectBaseBranch = useAppStore(
    (state) => state.projects.find((candidate) => candidate.id === projectId)?.baseBranch ?? null,
  );
  const forgetMount = useAppStore((state) => state.forgetMount);
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
  const mountView = mountViews.find((view) => view.id === mountId) ?? null;
  const isAttached =
    isMountAttached ??
    (mountView === null ? true : mountView.isAttached && mountView.worktreePath !== null);
  const keptPath = keptPathOf({ view: mountView, fallback: worktreePath });
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
  const forgetBlockerKey = useAppStore((state) =>
    mountId === undefined
      ? ''
      : [
          ...new Set(
            mountCleanupBlockers({
              state,
              sessionId,
              mountId,
              worktreePath: keptPath ?? worktreePath,
            }),
          ),
        ]
          .sort()
          .join(','),
  );
  const forgetBlockers = BLOCKER_CODES.filter((code) => forgetBlockerKey.split(',').includes(code));
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<ReadonlyArray<MountAssessment> | null>(null);
  const requestRef = useRef(0);
  const isClean =
    worktreeStatus != null && isWorkingTreeClean({ workingTree: worktreeStatus.workingTree });
  const label = menuLabel ?? `${projectName} actions`;

  const fail = (title: string, error: unknown) => {
    showToast('error', `${title}: ${formatError(error)}`);
    void emitNotification('error', 'warning', title, formatError(error), {
      sessionId,
      workspaceId,
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
    setConfirming(null);
  };

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    requestRef.current = requestRef.current + 1;
    setConfirming(null);
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
      showToast(
        summary === 'failed' ? 'error' : 'info',
        detachOutcomeMessage({
          kind: summary,
          projectName,
          worktreePath: summarized?.worktreePath ?? worktreePath,
        }),
      );
      if (summary === 'failed') {
        assess();
        return;
      }
      dropdown.close();
      setConfirming(null);
    } catch (error) {
      fail('could not detach the project', error);
    } finally {
      setIsBusy(false);
      setStage(null);
    }
  };

  const forget = async () => {
    if (mountId === undefined) {
      return;
    }
    setIsBusy(true);
    try {
      const result = await forgetMount({ sessionId, mountId });
      dropdown.close();
      setConfirming(null);
      showToast(
        'info',
        result.keptPath === null
          ? `Removed ${branch === '' ? 'the mount' : branch} from this session.`
          : `Removed ${branch === '' ? 'the mount' : branch} from this session. Files remain at ${result.keptPath}.`,
      );
    } catch (error) {
      fail('could not remove the mount', error);
    } finally {
      setIsBusy(false);
    }
  };

  const unmount = async () => {
    if (mountId === undefined) {
      return;
    }
    setIsBusy(true);
    try {
      const result = await unmountMount({ sessionId, mountId });
      dropdown.close();
      setConfirming(null);
      if (result.kept) {
        showToast('info', `Worktree kept at ${worktreePath}`);
      }
    } catch (error) {
      fail('could not unmount the branch', error);
    } finally {
      setIsBusy(false);
    }
  };

  const forgetNote =
    keptPath === null ? (
      <span className="text-2xs text-muted-foreground">
        This branch leaves the session. The branch and any pull request stay.
      </span>
    ) : (
      <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
        <span className="text-2xs">Its files stay on disk at</span>
        <span className="truncate font-mono text-2xs">{keptPath}</span>
      </div>
    );

  const keptNote = (
    <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
      <span className="text-2xs">Uncommitted changes stay on disk at</span>
      <span className="truncate font-mono text-2xs">{worktreePath}</span>
    </div>
  );

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
              setConfirming(null);
              return;
            }
            dropdown.toggle();
          }}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          className={cn('size-7', triggerClassName, dropdown.open && 'opacity-100')}
        />
      }
    >
      {confirming === 'unmount' ? (
        <div className="flex flex-col gap-2 p-3">
          <span className="text-xs font-medium">
            {branch === '' ? 'Unmount this branch?' : `Unmount ${branch}?`}
          </span>
          {isClean ? (
            <span className="text-2xs text-muted-foreground">
              Its worktree is removed. The branch and any pull request stay.
            </span>
          ) : (
            keptNote
          )}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void unmount()}>
              {isClean ? 'Unmount' : 'Unmount, keep changes'}
            </Button>
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {confirming === 'forget' ? (
        <div className="flex flex-col gap-2 p-3">
          <span className="text-xs font-medium">
            {branch === '' ? 'Remove this mount?' : `Remove ${branch}?`}
          </span>
          {forgetBlockers.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-1 text-2xs text-muted-foreground">
              {forgetBlockers.map((blocker) => (
                <p key={blocker} className="break-words">
                  {BLOCKER_SENTENCE[blocker]({ projectName })}
                </p>
              ))}
            </div>
          ) : (
            forgetNote
          )}
          <div className="flex items-center gap-1">
            {forgetBlockers.length === 0 && (
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void forget()}>
                Remove
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {confirming === 'detach' ? (
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
      {confirming === null ? (
        <div className="flex flex-col">
          {mountId === undefined ? null : isAttached ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming('unmount')}
              className="flex w-full items-center px-2.5 py-1.5 text-left motion-safe:transition-colors hover:bg-muted/40"
            >
              Unmount branch
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming('forget')}
              className="flex w-full items-center px-2.5 py-1.5 text-left motion-safe:transition-colors hover:bg-muted/40"
            >
              Remove from session
            </button>
          )}
          {canDetachProject && detachTargets.length > 0 ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setConfirming('detach');
                assess();
              }}
              className="flex w-full items-center px-2.5 py-1.5 text-left text-danger/90 motion-safe:transition-colors hover:bg-danger/10 hover:text-danger"
            >
              Detach project
            </button>
          ) : null}
        </div>
      ) : null}
    </AnchoredPopover>
  );
};
