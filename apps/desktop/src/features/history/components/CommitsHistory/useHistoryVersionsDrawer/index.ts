import { useEffect } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { HISTORY_SHOW_BACKUPS_EVENT, diffEventName } from '../../../../actions/kinds/diff';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly worktreePath: string;
};

export const useHistoryVersionsDrawer = ({ sessionId, mountId, worktreePath }: Params) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const showVersions = () => {
    if (mountId === null) {
      return;
    }
    openDrawer({ kind: 'history-versions', sessionId, payload: { mountId, worktreePath } });
  };
  useEffect(() => {
    if (mountId === null) {
      return;
    }
    const name = diffEventName({ name: HISTORY_SHOW_BACKUPS_EVENT, sessionId });
    const onShow = () =>
      openDrawer({ kind: 'history-versions', sessionId, payload: { mountId, worktreePath } });
    window.addEventListener(name, onShow);
    return () => window.removeEventListener(name, onShow);
  }, [mountId, openDrawer, sessionId, worktreePath]);
  return { showVersions };
};
