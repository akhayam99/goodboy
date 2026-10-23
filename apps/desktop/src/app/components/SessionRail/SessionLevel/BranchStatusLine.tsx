import { Button, StatusDot, Tooltip, TruncatedText, type Tone } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { distanceBehind, unmergedCount } from '../../../../shared/lib/gitStatus';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { actionButtonStateOf } from '../../../../features/actions/actionButtonStateOf';
import { useActionControls } from '../../../../features/actions/useActionControls';
import type { MountActionTarget } from '../../../../features/actions/types';
import { ActionConfirmPanel } from '../../../../features/actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../../../features/actions/components/ActionControls/ActionStatusLine';
import { REBASE_STOP_PANEL_STATES } from '../../../../features/history/components/rebaseStopPanelStates';
import { useRebaseJob } from '../../../../features/history/useRebaseJob';
import type { RebaseJobTone } from '../../../../features/history/rebaseJob';
import { branchStatusFactsOf } from './branchStatusFactsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly target: MountActionTarget;
};

const VERB_IDS = ['mount.abortRebase', 'mount.rebase'] as const;

const STOP_TONE: Readonly<Record<RebaseJobTone, Tone>> = {
  info: 'info',
  ok: 'success',
  warn: 'warning',
  danger: 'danger',
};

export const BranchStatusLine = ({ sessionId, row, status, target }: Props) => {
  const controls = useActionControls({ target });
  const rebase = useRebaseJob({ sessionId, worktreePath: row.worktreePath, isDetailed: false });
  const openMountCommits = useAppStore((state) => state.openMountCommits);
  const baseBranch = useAppStore((state) =>
    selectMountBaseBranch({ state, sessionId, path: row.worktreePath }),
  );
  const job = rebase?.job ?? null;
  const isJobRunning = job !== null && job.isRunning;
  const conflicts = status === null ? null : unmergedCount({ workingTree: status.workingTree });
  const text = branchStatusFactsOf({
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    conflicts,
    isRebasing: status?.inProgress === 'rebase' || isJobRunning,
    progress: job?.progress ?? null,
    baseBranch,
  });
  const verb = isJobRunning
    ? (controls.actions.find((action) => action.id === 'mount.abortRebase') ?? null)
    : (VERB_IDS.map((id) => controls.actions.find((action) => action.id === id)).find(
        (action) => action !== undefined,
      ) ?? null);
  const state =
    verb === null
      ? null
      : actionButtonStateOf({
          controls,
          actionId: verb.id,
          label: verb.id === 'mount.rebase' ? 'Rebase' : 'Abort',
          pendingLabel: verb.pendingLabel,
        });
  const button =
    verb === null || state === null ? null : (
      <Button
        size="xs"
        variant="ghost"
        data-worktree-verb={verb.id}
        disabled={verb.blockedReason !== null || state.isPending}
        isBusy={state.isPending}
        aria-label={verb.label}
        onClick={() => controls.trigger({ actionId: verb.id })}
      >
        <verb.icon size={ICON_SIZE.row} aria-hidden />
        {state.label}
      </Button>
    );
  const isNeedingYou = conflicts !== null && conflicts > 0;
  const hasFailure = controls.failure !== null;
  return (
    <div data-branch-status="" className="flex min-w-0 flex-col pl-5">
      {text === null ? null : (
        <div
          data-worktree-status=""
          role="status"
          className="relative flex min-h-7 min-w-0 items-center gap-2 pr-1 text-ui"
        >
          {isJobRunning ? <StatusDot tone="info" size="sm" pulsing /> : null}
          {!isJobRunning && isNeedingYou ? <StatusDot tone="warning" size="sm" /> : null}
          <span className="min-w-0 flex-1 text-muted-foreground">{text}</span>
          {button === null || verb === null ? null : verb.blockedReason === null ? (
            button
          ) : (
            <Tooltip content={verb.blockedReason}>
              <span className="inline-flex shrink-0">{button}</span>
            </Tooltip>
          )}
          <ActionConfirmPanel controls={controls} />
        </div>
      )}
      {hasFailure ? (
        <div data-branch-failure="" className="min-w-0 pr-1">
          <ActionStatusLine controls={controls} showReasons={false} />
        </div>
      ) : null}
      {job !== null && job.state !== 'pushed' && REBASE_STOP_PANEL_STATES.has(job.state) ? (
        <div
          data-rebase-conflict=""
          className="flex min-h-7 min-w-0 items-center gap-2 pr-1 text-ui"
        >
          <StatusDot tone={STOP_TONE[job.tone]} size="sm" pulsing={job.isRunning} />
          <TruncatedText className="min-w-0 flex-1 truncate text-muted-foreground">
            {job.title}
          </TruncatedText>
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Open rebase of ${row.branch}`}
            onClick={() => openMountCommits({ sessionId, mountId: row.mountId })}
          >
            Open rebase
          </Button>
        </div>
      ) : null}
    </div>
  );
};
