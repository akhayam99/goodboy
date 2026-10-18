import { Button } from '@goodboy/ui';
import type { RebaseJobControls } from '../useRebaseJob';
import type { useJobBannerActions } from '../hooks/useJobBannerActions';
import { ForgetSavedButton } from './ForgetSavedButton';
import { JobBannerDetails } from './JobBannerDetails';

type Props = {
  readonly controls: RebaseJobControls;
  readonly actions: ReturnType<typeof useJobBannerActions>;
  readonly isNoteOpen: boolean;
  readonly onToggleNote: () => void;
};

export const JobBannerActions = ({ controls, actions, isNoteOpen, onToggleNote }: Props) => {
  const { job, agentId, canUndo } = controls;
  const { pendingKeys } = actions;
  const seeWhatItDid =
    agentId === null ? null : (
      <Button size="sm" variant="ghost" onClick={controls.seeWhatItDid}>
        See what it did
      </Button>
    );
  const dismiss = (
    <Button size="sm" variant="ghost" onClick={controls.dismiss}>
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
            Bring them back
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
    case 'fixing-push':
      return seeWhatItDid;
    case 'done':
      return (
        <>
          {canUndo ? (
            <Button size="sm" variant="ghost" onClick={controls.undo}>
              Undo rewrite
            </Button>
          ) : null}
          {dismiss}
        </>
      );
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
    case 'dirty':
      return (
        <>
          <Button size="sm" onClick={controls.checkAgain}>
            Check again
          </Button>
          <Button size="sm" variant="secondary" onClick={controls.openTerminal}>
            Open terminal
          </Button>
          {dismiss}
        </>
      );
    case 'head-moved':
      return (
        <>
          <Button size="sm" isBusy={pendingKeys.has('retry-rebase')} onClick={actions.retryRebase}>
            Retry rebase
          </Button>
          {dismiss}
        </>
      );
    case 'push-failed':
      return (
        <>
          <Button size="sm" isBusy={pendingKeys.has('fix-push')} onClick={actions.fixPush}>
            Fix with agent
          </Button>
          <Button size="sm" variant="secondary" onClick={controls.openPushTerminal}>
            Open terminal here
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isBusy={pendingKeys.has('retry-push')}
            onClick={actions.retryPush}
          >
            Retry push
          </Button>
          {job.detail === null ? null : <JobBannerDetails detail={job.detail} />}
          {dismiss}
        </>
      );
    case 'origin-moved':
      return (
        <>
          <Button size="sm" isBusy={pendingKeys.has('bring-origin')} onClick={actions.bringOrigin}>
            Bring them into the plan
          </Button>
          {dismiss}
        </>
      );
    case 'auto-resolving':
      return (
        <>
          {agentId === null ? null : (
            <Button size="sm" variant="ghost" onClick={controls.seeWhatItDid}>
              Open Auto
            </Button>
          )}
          {dismiss}
        </>
      );
    case 'auto-done':
    case 'result-differs':
    case 'blocked':
    case 'failed':
      return dismiss;
    case 'conflict':
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
