import { useEffect, useState } from 'react';
import { dismissTopEscapeLayer } from '@goodboy/ui';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import { useAppStore } from '../../../../../store';
import { mockSceneIpc } from '../mockSceneIpc';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStudioChrome } from '../shellChrome';

const ASK_DELAY_MS = 400;

type Props = {
  readonly isAsking: boolean;
};

export const SessionCloseScene = ({ isAsking }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(() => undefined);
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState({
      sessionDrafts: {
        [WORKSPACE_ID]: {
          ...EMPTY_SESSION_DRAFT,
          startKind: 'workflow',
          startShape: 'orchestrated',
          hasChosenStart: true,
          workflowGoal: 'Round the ledger-core postings to the settlement currency',
        },
      },
      openSessionDraftWorkspaceId: WORKSPACE_ID,
      currentSessionId: null,
    });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady || !isAsking) {
      return;
    }
    const timer = window.setTimeout(dismissTopEscapeLayer, ASK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isAsking, isReady]);

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
    />
  );
};
