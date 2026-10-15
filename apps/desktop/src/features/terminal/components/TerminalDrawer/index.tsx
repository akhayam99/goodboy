import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import {
  findTerminalTab,
  terminalWorktreeKeyIn,
} from '../../../../store/slices/terminal/terminalWorktree';
import { TerminalDrawerBody } from './TerminalDrawerBody';

type Props = {
  readonly sessionId: SessionId;
  readonly terminalId: TerminalTabId;
  readonly onClose: () => void;
};

export const TerminalDrawer = ({ sessionId, terminalId, onClose }: Props) => {
  const [worktreeKey] = useState<string | null>(() => {
    const state = useAppStore.getState();
    const tab = findTerminalTab({ state, tabId: terminalId });
    return tab === null ? null : terminalWorktreeKeyIn({ state, tab });
  });
  const workspaceId = useAppStore(
    (s) => sessionById(s.sessions, sessionId)?.workspaceId ?? s.currentWorkspaceId,
  );

  useEffect(() => {
    if (worktreeKey === null || workspaceId === null) {
      onClose();
    }
  }, [worktreeKey, workspaceId, onClose]);

  if (worktreeKey === null || workspaceId === null) {
    return null;
  }
  return (
    <TerminalDrawerBody
      workspaceId={workspaceId}
      sessionId={sessionId}
      worktreeKey={worktreeKey}
      onClose={onClose}
    />
  );
};
