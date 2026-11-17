import type { ActionControls } from '../../../../../features/actions/useActionControls';
import { ActionStatusLine } from '../../../../../features/actions/components/ActionControls/ActionStatusLine';
import {
  pushFailedError,
  type PushFailedError,
} from '../../../../../features/actions/kinds/pushFailedError';
import { ONLINE_COPY_CHANGED_MESSAGE } from '../../../../../features/history/onlineCopyChangedMessage';
import { PushFailureActions } from '../../../../../features/branch/components/BranchHeader/PushFailureActions';
import { OriginCheckAsk } from '../../../../../features/branch/components/BranchHeader/PushFailureActions/OriginCheckAsk';
import { SESSION_ID } from '../resolveSeed';
import { REBASE_JOB_MOUNT_ID } from '../u24/rebaseJobSeed';

type Variant = 'plain' | 'force' | 'origin-moved' | 'origin-checked';

type Props = {
  readonly variant: Variant;
};

const HOOK_OUTPUT = 'pre-push hook declined: seenEvents is assigned but never used';

const ORIGIN_CHECK = {
  remoteSha: '9d2c41f7a0b3e5c8d1f6a2b4c7e9f0a1b3c5d7e9',
  onlyOnline: [
    {
      sha: '4e8a1c2d3f5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c',
      subject: 'Retry the Northwind webhook once on a timeout',
      author: 'Acme',
    },
    {
      sha: '7b3f9e1a2c4d6e8f0a1b3c5d7e9f1a2b4c6d8e0f',
      subject: 'Log the ledger-core posting id',
      author: 'Cascadia',
    },
  ],
};

type ControlsParams = {
  readonly error: PushFailedError;
};

const controlsOf = ({ error }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: null,
  pendingSeconds: null,
  confirming: null,
  failure: { actionId: 'diff.push', message: error.message, error, choice: null },
  outcome: null,
  trigger: () => undefined,
  confirm: async () => undefined,
  cancel: () => undefined,
  retry: () => undefined,
  dismissFailure: () => undefined,
  dismissOutcome: () => undefined,
});

export const PushFailureScene = ({ variant }: Props) => {
  const isOriginMoved = variant === 'origin-moved' || variant === 'origin-checked';
  const isForce = variant !== 'plain';
  const error = pushFailedError({
    message: isOriginMoved ? ONLINE_COPY_CHANGED_MESSAGE : HOOK_OUTPUT,
    mountId: REBASE_JOB_MOUNT_ID,
    isForce,
    confirmedOnlyOnline: null,
    confirmedRemoteSha: null,
    isOriginMoved,
  });
  return (
    <div className="flex w-[720px] flex-col gap-2 bg-background p-6">
      <p className="text-meta text-foreground">hl/fix-duplicate-credit</p>
      <ActionStatusLine
        controls={controlsOf({ error })}
        showReasons={false}
        canRetry={!isOriginMoved}
        failureActions={
          variant === 'origin-checked' ? (
            <OriginCheckAsk
              check={ORIGIN_CHECK}
              phase="idle"
              onForcePush={() => undefined}
              onRebase={() => undefined}
            />
          ) : (
            <PushFailureActions
              sessionId={SESSION_ID}
              mountId={error.mountId}
              isForce={error.isForce}
              confirmedOnlyOnline={null}
              confirmedRemoteSha={null}
              isOriginMoved={isOriginMoved}
              message={error.message}
              onResolved={() => undefined}
            />
          )
        }
      />
    </div>
  );
};
