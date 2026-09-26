import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

export const NewSessionBridge = () => {
  const openSessionDraft = useAppStore((s) => s.openSessionDraft);

  useEffect(() => {
    const onNewSessionRequest = () => {
      openSessionDraft();
    };
    window.addEventListener('goodboy:new-session', onNewSessionRequest);
    return () => window.removeEventListener('goodboy:new-session', onNewSessionRequest);
  }, [openSessionDraft]);

  return null;
};
