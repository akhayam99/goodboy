import { useEffect, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { DoneColumnBoardPage } from './DoneColumnBoardPage';

type Props = {
  readonly isDoneOpen: boolean;
};

export const DoneColumnScene = ({ isDoneOpen }: Props) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    seedBoardScene();
    useAppStore.getState().setSessionViewPrefs({
      workspaceId: WORKSPACE_ID,
      patch: { group: 'none', isArchivedShown: false },
    });
    useAppStore.setState({ sessionGroupExpanded: isDoneOpen ? { done: true } : {} });
    setSession(useAppStore.getState().sessions[0] ?? null);
  }, [isDoneOpen]);

  if (session === null) {
    return null;
  }
  return <WorkspaceFrame session={session} main={<DoneColumnBoardPage />} hasRail={false} />;
};
