import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { MainRegion } from '../../../../MainRegion';
import { mockSceneIpc } from '../../mockSceneIpc';
import { WORKSPACE_ID, seedBoardScene } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { seedStudioChrome } from '../../shellChrome';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const HomePlaceScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    mockSceneIpc(() => undefined);
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState({
      currentSessionId: null,
      openHomeWorkspaceId: WORKSPACE_ID,
    });
    setIsReady(true);
  }, [theme]);

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      columnPlace="home"
      main={
        <MainRegion
          workspaceId={WORKSPACE_ID}
          currentSession={null}
          isDraftShown={false}
          renderedIds={[]}
          activeId={null}
        />
      }
    />
  );
};
