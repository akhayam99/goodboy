import type { SessionId } from '@goodboy/types';
import { ActionConfirmPanel } from '../../actions/components/ActionControls/ActionConfirmPanel';
import { ActionStatusLine } from '../../actions/components/ActionControls/ActionStatusLine';
import { pushFailureOf } from '../../actions/kinds/pushFailureOf';
import { PushFixStatus } from '../../history/pushFix/PushFixStatus';
import { StaleDepsNotice } from '../../../shared/components/StaleDepsNotice';
import { useAppStore } from '../../../store';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import type { BranchControls } from '../hooks/useBranchControls';
import { usePushFailureSlots } from '../hooks/usePushFailureSlots';
import { BranchSetupOffer } from './BranchHeader/BranchSetupOffer';

type Props = {
  readonly sessionId: SessionId;
  readonly controls: BranchControls;
  readonly isPushNext: boolean;
  readonly isSetupOfferShown: boolean;
};

export const BranchNotices = ({ sessionId, controls, isPushNext, isSetupOfferShown }: Props) => {
  const pushFailure = pushFailureOf({ error: controls.diffControls.failure?.error });
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  const pushSlots = usePushFailureSlots({ sessionId, controls: controls.diffControls });
  return (
    <>
      {(isPushNext || pushFailure !== null) && activeMountId !== null && (
        <StaleDepsNotice
          sessionId={sessionId}
          mountId={activeMountId}
          {...(pushFailure === null ? {} : { onInstalled: controls.diffControls.retry })}
        />
      )}
      {isSetupOfferShown && activeMountId !== null && (
        <BranchSetupOffer sessionId={sessionId} mountId={activeMountId} />
      )}
      {pushFailure === null && activeMountId !== null && (
        <PushFixStatus sessionId={sessionId} mountId={activeMountId} />
      )}
      <ActionStatusLine controls={controls.diffControls} showReasons={false} {...pushSlots} />
      <ActionConfirmPanel controls={controls.diffControls} />
      <ActionStatusLine controls={controls.pullRequestControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.pullRequestControls} />
      <ActionStatusLine controls={controls.sessionControls} showReasons={false} />
      <ActionConfirmPanel controls={controls.sessionControls} />
    </>
  );
};
