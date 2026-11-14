import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { SessionTools } from '../../../../../../features/session/components/SessionTools';

type Props = {
  readonly sessionId: SessionId;
};

export const SlotSceneRail = ({ sessionId }: Props) => {
  const host = useContext(DrawerEdgeContext);
  return host === null ? null : createPortal(<SessionTools sessionId={sessionId} />, host);
};
