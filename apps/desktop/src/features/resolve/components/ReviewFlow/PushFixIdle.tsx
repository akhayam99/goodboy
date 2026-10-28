import type { MountId, SessionId } from '@goodboy/types';
import { PushFixStatus } from '../../../../shared/components/PushFixStatus';
import { useAppStore } from '../../../../store';
import type { ReviewPush } from './useReviewPush';
import { selectActiveMountId } from '../../../../store/slices/project-mounts/selectors';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly onSettled: ReviewPush['retryAfterFix'];
};

export const PushFixIdle = ({ sessionId, mountId, onSettled }: Props) => {
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  const target = mountId ?? activeMountId;
  if (target === null) {
    return null;
  }
  return <PushFixStatus sessionId={sessionId} mountId={target} onSettled={onSettled} />;
};
