import { Button, StatusDot, Tooltip, TruncatedText } from '@goodboy/ui';
import type { WorktreeStatus } from '@goodboy/types';
import { distanceBehind, unmergedCount } from '../../../../shared/lib/gitStatus';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { actionButtonStateOf } from '../../../../features/actions/actionButtonStateOf';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { ActionConfirmPanel } from '../../../../features/actions/components/ActionControls/ActionConfirmPanel';
import type { RebaseJob } from '../../../../features/history/rebaseJob';
import { worktreeStatusFactsOf } from './worktreeStatusFacts';

type Props = {
  readonly status: WorktreeStatus | null;
  readonly baseBranch: string | null;
  readonly job: RebaseJob | null;
  readonly controls: ActionControls;
};

const VERB_IDS = ['mount.abortRebase', 'mount.rebase'] as const;

export const WorktreeStatusLine = ({ status, baseBranch, job, controls }: Props) => {
  const isJobRunning = job !== null && job.isRunning;
  const conflicts = status === null ? null : unmergedCount({ workingTree: status.workingTree });
  const text = worktreeStatusFactsOf({
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
  if (text === null) {
    return null;
  }
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
  return (
    <div
      data-worktree-status=""
      role="status"
      className="relative flex h-7 min-w-0 items-center gap-2 px-2 text-ui"
    >
      {isJobRunning ? <StatusDot tone="info" size="sm" pulsing /> : null}
      {!isJobRunning && isNeedingYou ? <StatusDot tone="warning" size="sm" /> : null}
      <TruncatedText className="min-w-0 flex-1 text-muted-foreground">{text}</TruncatedText>
      {button === null || verb === null ? null : verb.blockedReason === null ? (
        button
      ) : (
        <Tooltip content={verb.blockedReason}>
          <span className="inline-flex shrink-0">{button}</span>
        </Tooltip>
      )}
      <ActionConfirmPanel controls={controls} />
    </div>
  );
};
