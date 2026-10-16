import { Tooltip, TruncatedText } from '@goodboy/ui';
import type { WorktreeStatus } from '@goodboy/types';
import { distanceBehind, unmergedCount } from '../../../../shared/lib/gitStatus';
import { actionButtonStateOf } from '../../../../features/actions/actionButtonStateOf';
import type { ActionControls } from '../../../../features/actions/useActionControls';
import { ActionConfirmPanel } from '../../../../features/actions/components/ActionControls/ActionConfirmPanel';
import { worktreeStatusFactsOf } from './worktreeStatusFacts';

type Props = {
  readonly status: WorktreeStatus | null;
  readonly baseBranch: string | null;
  readonly controls: ActionControls;
};

const VERB_IDS = ['mount.abortRebase', 'mount.rebase'] as const;

export const WorktreeStatusLine = ({ status, baseBranch, controls }: Props) => {
  const text = worktreeStatusFactsOf({
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    conflicts: status === null ? null : unmergedCount({ workingTree: status.workingTree }),
    isRebasing: status?.inProgress === 'rebase',
    baseBranch,
  });
  const verb =
    VERB_IDS.map((id) => controls.actions.find((action) => action.id === id)).find(
      (action) => action !== undefined,
    ) ?? null;
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
      <button
        type="button"
        data-worktree-verb={verb.id}
        disabled={verb.blockedReason !== null || state.isPending}
        aria-busy={state.isPending ? true : undefined}
        aria-label={verb.label}
        onClick={() => controls.trigger({ actionId: verb.id })}
        className="shrink-0 rounded-md px-1 text-label text-foreground hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        {state.label}
      </button>
    );
  return (
    <div
      data-worktree-status=""
      role="status"
      className="relative flex h-7 min-w-0 items-center gap-2 px-2 text-label"
    >
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
