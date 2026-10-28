import { useEffect, useState } from 'react';
import { ActionStatusLine } from '../../../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ActionControls } from '../../../../../features/actions/useActionControls';
import {
  pushFailedError,
  type PushFailedError,
} from '../../../../../features/actions/kinds/pushFailedError';
import { PushFailureActions } from '../../../../../features/branch/components/BranchHeader/PushFailureActions';
import { PushFailureBlock } from '../../../../../shared/components/PushFailureBlock';
import { PushFixStatus } from '../../../../../shared/components/PushFixStatus';
import { StaleDepsNotice } from '../../../../../shared/components/StaleDepsNotice';
import { MOUNT_TARGET, SESSION } from '../resolveSeed';
import { pushDepsSeed, type PushDepsVariant } from './pushDepsSeed';

type Props = {
  readonly variant: PushDepsVariant;
};

type ControlsParams = {
  readonly error: PushFailedError;
};

const HOOK_OUTPUT = [
  '$ pnpm typecheck',
  'src/ledger/postings.ts:41 Type error: "legacy-flex" is not assignable to type "Tone"',
  'husky - pre-push script failed (code 1)',
  `error: failed to push some refs to 'github.com:harborline/payments-api.git'`,
].join('\n');

const failureControlsOf = ({ error }: ControlsParams): ActionControls => ({
  target: null,
  actions: [],
  inSlot: () => [],
  pendingId: null,
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

const FAILURE_VARIANTS: ReadonlySet<PushDepsVariant> = new Set([
  'working',
  'deps-linked',
  'deps-installing',
]);

export const PushDepsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    pushDepsSeed({ variant });
    setIsReady(true);
  }, [variant]);

  if (!isReady) {
    return null;
  }
  const error = pushFailedError({
    message: HOOK_OUTPUT,
    mountId: MOUNT_TARGET.mountId,
    isForce: false,
    confirmedOnlyOnline: null,
    confirmedRemoteSha: null,
  });
  const isFailureShown = FAILURE_VARIANTS.has(variant);
  return (
    <main className="mx-auto flex w-[720px] flex-col gap-3 bg-background p-6">
      <p className="text-meta text-foreground">hl/fix-duplicate-credit</p>
      <StaleDepsNotice sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />
      {isFailureShown ? (
        <ActionStatusLine
          controls={failureControlsOf({ error })}
          showReasons={false}
          failureDetail={<PushFailureBlock output={error.message} />}
          failureActions={
            <PushFailureActions
              sessionId={SESSION.id}
              mountId={MOUNT_TARGET.mountId}
              isForce={false}
              confirmedOnlyOnline={null}
              confirmedRemoteSha={null}
              message={error.message}
              onResolved={() => undefined}
              onRetry={() => undefined}
            />
          }
        />
      ) : (
        <PushFixStatus sessionId={SESSION.id} mountId={MOUNT_TARGET.mountId} />
      )}
    </main>
  );
};
