import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { pushFailureOf } from '../../../actions/kinds/pushFailureOf';
import { PushFixStatusLine } from '../../../history/pushFix/PushFixStatusLine';
import { PushFailureBlock } from '../../../../shared/components/PushFailureBlock';
import { StartHint } from '../../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../../shared/components/startHintCopy';
import { usePushFix } from '../../../../shared/hooks/usePushFix';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { PushFailureActions } from '../../components/BranchHeader/PushFailureActions';
import type { BranchControls } from '../useBranchControls';

type Params = {
  readonly sessionId: SessionId;
  readonly controls: BranchControls['diffControls'];
};

type PushFailureSlots = Readonly<{
  failureHint: ReactNode;
  failureDetail: ReactNode;
  failureActions: ReactNode;
  canRetry: boolean;
}>;

const NO_FAILURE: PushFailureSlots = {
  failureHint: null,
  failureDetail: null,
  failureActions: null,
  canRetry: true,
};

export const usePushFailureSlots = ({ sessionId, controls }: Params): PushFailureSlots => {
  const pushFailure = pushFailureOf({ error: controls.failure?.error });
  const fix = usePushFix({ sessionId, mountId: pushFailure?.mountId ?? null });
  if (pushFailure === null) {
    return NO_FAILURE;
  }
  const isFixIdle = fix.kind === 'none' || fix.kind === 'pushed';
  return {
    failureHint:
      fix.kind === 'working' ? null : (
        <div className="w-full max-w-md">
          <StartHint
            sessionId={sessionId}
            scope={START_HINT_SCOPES.pushFix({ mountId: pushFailure.mountId })}
            label={START_HINT_COPY.implementerLabel}
            placeholder={START_HINT_COPY.pushFix}
          />
        </div>
      ),
    failureDetail: (
      <div className="flex min-w-0 flex-col gap-2">
        {isFixIdle ? null : <PushFixStatusLine sessionId={sessionId} state={fix} />}
        <PushFailureBlock output={pushFailure.message} />
      </div>
    ),
    failureActions: (
      <PushFailureActions
        sessionId={sessionId}
        mountId={pushFailure.mountId}
        isForce={pushFailure.isForce}
        confirmedOnlyOnline={pushFailure.confirmedOnlyOnline?.map((commit) => commit.sha) ?? null}
        confirmedRemoteSha={pushFailure.confirmedRemoteSha}
        isOriginMoved={pushFailure.isOriginMoved}
        message={pushFailure.message}
        onResolved={controls.dismissFailure}
      />
    ),
    canRetry: !pushFailure.isOriginMoved && isFixIdle,
  };
};
