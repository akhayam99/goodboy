import { useMemo } from 'react';
import { ActionStatusLine } from '../../../../../features/actions/components/ActionControls/ActionStatusLine';
import { pushFailedError } from '../../../../../features/actions/kinds/pushFailedError';
import type { ActionControls } from '../../../../../features/actions/useActionControls';
import { usePushFailureSlots } from '../../../../../features/branch/hooks/usePushFailureSlots';
import { MOUNT_TARGET, SESSION } from '../resolveSeed';

type Props = {
  readonly output: string;
};

export const PushFailureCardScene = ({ output }: Props) => {
  const controls = useMemo<ActionControls>(() => {
    const error = pushFailedError({
      message: output,
      mountId: MOUNT_TARGET.mountId,
      isForce: false,
      confirmedOnlyOnline: null,
      confirmedRemoteSha: null,
    });
    return {
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
    };
  }, [output]);
  const slots = usePushFailureSlots({ sessionId: SESSION.id, controls });
  return <ActionStatusLine controls={controls} showReasons={false} {...slots} />;
};
