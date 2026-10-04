import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { HISTORY_SHOW_BACKUPS_EVENT, diffEventName } from '../../../../actions/kinds/diff';

export const useHistoryBackupsPanel = ({ sessionId }: { readonly sessionId: SessionId }) => {
  const [isShowingBackups, setIsShowingBackups] = useState(false);
  useEffect(() => {
    const name = diffEventName({ name: HISTORY_SHOW_BACKUPS_EVENT, sessionId });
    const onShow = () => setIsShowingBackups(true);
    window.addEventListener(name, onShow);
    return () => window.removeEventListener(name, onShow);
  }, [sessionId]);
  return {
    isShowingBackups,
    showBackups: () => setIsShowingBackups(true),
    hideBackups: () => setIsShowingBackups(false),
  };
};
