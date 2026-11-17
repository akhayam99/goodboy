import { Button } from '@goodboy/ui';
import type { RebaseJobControls } from '../useRebaseJob';
import type { useJobBannerActions } from '../hooks/useJobBannerActions';
import { ForgetSavedButton } from './ForgetSavedButton';

type Props = {
  readonly controls: RebaseJobControls;
  readonly actions: ReturnType<typeof useJobBannerActions>;
  readonly isNoteOpen: boolean;
  readonly onToggleNote: () => void;
};

export const JobBannerActions = ({ controls, actions, isNoteOpen, onToggleNote }: Props) => {
  const { job, agentId } = controls;
  const { pendingKeys } = actions;
  const seeWhatItDid =
    agentId === null ? null : (
      <Button size="sm" variant="ghost" onClick={controls.seeWhatItDid}>
        Open agent
      </Button>
    );
  const dismiss = (
    <Button size="sm" variant="ghost" onClick={controls.dismissCard}>
      Dismiss
    </Button>
  );
  switch (job.state) {
    case 'choosing':
      return (
        <>
          <Button size="sm" isBusy={pendingKeys.has('stash-move')} onClick={actions.stashAndMove}>
            Stash and rebase
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pendingKeys.has('stash-move')}
            onClick={controls.dismiss}
          >
            Cancel
          </Button>
        </>
      );
    case 'restore-conflict':
      return (
        <>
          <Button size="sm" variant="ghost" onClick={controls.openTerminal}>
            Open terminal
          </Button>
          <Button size="sm" variant="ghost" onClick={actions.copyStashCommand}>
            Copy the stash command
          </Button>
          <ForgetSavedButton
            isBusy={pendingKeys.has('forget-saved')}
            onConfirm={actions.forgetSaved}
          />
        </>
      );
    case 'set-aside':
      return (
        <>
          <Button size="sm" isBusy={pendingKeys.has('bring-back')} onClick={actions.bringBack}>
            Restore stashed files
          </Button>
          <Button size="sm" variant="ghost" onClick={controls.openTerminal}>
            Open terminal
          </Button>
          <ForgetSavedButton
            isBusy={pendingKeys.has('forget-saved')}
            onConfirm={actions.forgetSaved}
          />
        </>
      );
    case 'merging':
      return seeWhatItDid;
    case 'stuck':
      return (
        <>
          <Button
            size="sm"
            aria-expanded={isNoteOpen}
            isBusy={pendingKeys.has('retry-note')}
            onClick={onToggleNote}
          >
            Retry with a note
          </Button>
          {seeWhatItDid}
          {dismiss}
        </>
      );
    case 'no-provider':
      return (
        <>
          <Button size="sm" onClick={controls.openProviders}>
            Open providers
          </Button>
          {dismiss}
        </>
      );
    case 'done':
    case 'conflict':
    case 'rebasing-here':
    case 'rebased-here':
    case 'auto-resolving':
    case 'auto-done':
    case 'pushed':
    case 'origin-moved':
    case 'push-failed':
    case 'fixing-push':
    case 'dirty':
    case 'head-moved':
    case 'blocked':
    case 'result-differs':
    case 'failed':
    case 'checking':
    case 'replaying':
    case 'checking-result':
    case 'waiting':
    case 'moving':
    case 'updating-online':
      return null;
    default: {
      const exhaustive: never = job.state;
      return exhaustive;
    }
  }
};
