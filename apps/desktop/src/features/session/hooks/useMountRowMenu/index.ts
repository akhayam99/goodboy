import type { MountId, SessionId } from '@goodboy/types';
import type { MountActionTarget, ObjectMenuTrigger } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useMountMenuTarget } from '../useMountMenuTarget';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly anchorKey: string;
};

type MountRowMenu = ObjectMenuTrigger & {
  readonly target: MountActionTarget | null;
};

export const useMountRowMenu = ({ sessionId, mountId, anchorKey }: Params): MountRowMenu => {
  const target = useMountMenuTarget({ sessionId, mountId });
  const { onContextMenu, onKeyDown } = useObjectMenuTrigger({ target, anchorKey });
  return { target, onContextMenu, onKeyDown };
};
