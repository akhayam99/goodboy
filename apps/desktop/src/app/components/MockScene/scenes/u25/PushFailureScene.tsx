import type { ActionControls } from '../../../../../features/actions/useActionControls';
import { ActionStatusLine } from '../../../../../features/actions/components/ActionControls/ActionStatusLine';
import {
  pushFailedError,
  type PushFailedError,
} from '../../../../../features/actions/kinds/pushFailedError';
import { PushFailureActions } from '../../../../../features/branch/components/BranchHeader/PushFailureActions';
import { SESSION_ID } from '../resolveSeed';
import { REBASE_JOB_MOUNT_ID } from '../u24/rebaseJobSeed';

type Variant = 'plain' | 'force';

type Props = {
  readonly variant: Variant;
};

const HOOK_OUTPUT = 'pre-push hook declined: seenEvents is assigned but never used';

type ControlsParams = {
  readonly error: PushFailedError;
};

const controlsOf = ({ error }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: null,
  confirming: null,
  failure: { actionId: 'diff.push', message: error.message, error, choice: null },
  trigger: () => undefined,
  confirm: async () => undefined,
  cancel: () => undefined,
  retry: () => undefined,
  dismissFailure: () => undefined,
});

export const PushFailureScene = ({ variant }: Props) => {
  const isForce = variant === 'force';
  const error = pushFailedError({
    message: HOOK_OUTPUT,
    mountId: REBASE_JOB_MOUNT_ID,
    isForce,
    confirmedOnlyOnline: null,
    confirmedRemoteSha: null,
  });
  return (
    <div className="flex w-[720px] flex-col gap-2 bg-background p-6">
      <p className="text-label text-foreground">hl/fix-duplicate-credit</p>
      <ActionStatusLine
        controls={controlsOf({ error })}
        showReasons={false}
        failureActions={
          <PushFailureActions
            sessionId={SESSION_ID}
            mountId={error.mountId}
            isForce={error.isForce}
            confirmedOnlyOnline={null}
            confirmedRemoteSha={null}
            message={error.message}
            onResolved={() => undefined}
          />
        }
      />
    </div>
  );
};
