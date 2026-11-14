import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { AskDrawerBody } from './AskDrawerBody';

type Props = {
  readonly sessionId: SessionId;
  readonly isPage?: boolean;
  readonly onClose: () => void;
};

export const AskDrawer = ({ sessionId, isPage = false, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  if (session === null) {
    return null;
  }
  return <AskDrawerBody key={sessionId} session={session} isPage={isPage} onClose={onClose} />;
};
