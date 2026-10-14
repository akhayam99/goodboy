import type { SessionId } from '@goodboy/types';
import type { ComponentType } from 'react';
import { useAppStore } from '../../../../store';
import type { NewDrawerPayload } from '../../../../store/slices/drawer/state';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { useAutoExperiment } from '../../hooks/useAutoExperiment';
import { NewDrawerBody } from './NewDrawerBody';
import type { WritePanelProps } from '../../../artifacts/writePanelProps';

type Props = {
  readonly sessionId: SessionId;
  readonly payload: NewDrawerPayload | null;
  readonly writePanel: ComponentType<WritePanelProps>;
  readonly onClose: () => void;
};

export const NewDrawer = ({ sessionId, payload, writePanel, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  const isAuto = useAutoExperiment();
  if (session === null) {
    return null;
  }
  return (
    <NewDrawerBody
      key={sessionId}
      session={session}
      payload={payload}
      isAuto={isAuto}
      writePanel={writePanel}
      onClose={onClose}
    />
  );
};
