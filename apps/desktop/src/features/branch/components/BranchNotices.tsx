import type { SessionId } from '@goodboy/types';
import { ActionConfirmPanel } from '../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../actions/components/ActionControls/ActionStatusLine';
import { pushFailureOf } from '../../actions/kinds/pushFailureOf';
import { PushFailureBlock } from '../../../shared/components/PushFailureBlock';
import { PushFixStatus } from '../../../shared/components/PushFixStatus';
import { StaleDepsNotice } from '../../../shared/components/StaleDepsNotice';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import { useAppStore } from '../../../store';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import type { BranchControls } from '../hooks/useBranchControls';
import { BranchSetupOffer } from './BranchHeader/BranchSetupOffer';
import { PushFailureActions } from './BranchHeader/PushFailureActions';

type Props = {
  readonly sessionId: SessionId;
  readonly controls: BranchControls;
  readonly isPushNext: boolean;
};

export const BranchNotices = ({ sessionId, controls, isPushNext }: Props) => {
  const pushFailure = pushFailureOf({ error: controls.diffControls.failure?.error });
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  return (
    <>
      {(isPushNext || pushFailure !== null) && activeMountId !== null && (
        <StaleDepsNotice
          sessionId={sessionId}
          mountId={activeMountId}
          {...(pushFailure === null ? {} : { onInstalled: controls.diffControls.retry })}
        />
      )}
      {activeMountId !== null && <BranchSetupOffer sessionId={sessionId} mountId={activeMountId} />}
      {pushFailure === null && activeMountId !== null && (
        <PushFixStatus sessionId={sessionId} mountId={activeMountId} />
      )}
      <ActionStatusLine
        controls={controls.diffControls}
        showReasons={false}
        failureHint={
          pushFailure === null ? null : (
            <div className="w-full max-w-md">
              <StartHint
                sessionId={sessionId}
                scope={START_HINT_SCOPES.pushFix({ mountId: pushFailure.mountId })}
                label={START_HINT_COPY.implementerLabel}
                placeholder={START_HINT_COPY.pushFix}
              />
            </div>
          )
        }
        failureDetail={
          pushFailure === null ? null : <PushFailureBlock output={pushFailure.message} />
        }
        failureActions={
          pushFailure === null ? null : (
            <PushFailureActions
              sessionId={sessionId}
              mountId={pushFailure.mountId}
              isForce={pushFailure.isForce}
              confirmedOnlyOnline={
                pushFailure.confirmedOnlyOnline?.map((commit) => commit.sha) ?? null
              }
              confirmedRemoteSha={pushFailure.confirmedRemoteSha}
              message={pushFailure.message}
              onResolved={controls.diffControls.dismissFailure}
            />
          )
        }
      />
      <ActionConfirmPanel controls={controls.diffControls} />
      <ActionStatusLine controls={controls.pullRequestControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.pullRequestControls} />
      <ActionStatusLine controls={controls.sessionControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.sessionControls} />
    </>
  );
};
