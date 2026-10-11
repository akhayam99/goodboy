import { Button } from '@goodboy/ui';
import type { RebaseJobControls } from '../useRebaseJob';

type Props = {
  readonly controls: RebaseJobControls;
};

export const JobBannerActions = ({ controls }: Props) => {
  const { job, agentId, canUndo } = controls;
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
    case 'merging':
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
          <Button size="sm" variant="secondary" onClick={controls.refresh}>
            Refresh
          </Button>
          {dismiss}
        </>
      );
    case 'push-failed':
      return (
        <>
          <Button size="sm" variant="secondary" onClick={controls.openTerminal}>
            Open terminal
          </Button>
          {dismiss}
        </>
      );
    case 'origin-moved':
    case 'result-differs':
    case 'blocked':
    case 'failed':
      return dismiss;
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
