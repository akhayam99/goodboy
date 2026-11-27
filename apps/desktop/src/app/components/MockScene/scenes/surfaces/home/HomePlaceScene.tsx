import { useEffect, useState } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { MainRegion } from '../../../../MainRegion';
import { WORKSPACE_ID, seedBoardScene } from '../../BoardScene';
import { seedPolicyScene } from '../../providerPolicySeed';
import { installSceneDatabase } from '../../sceneDatabase';
import { StudioFrame } from '../../StudioFrame';
import { seedStudioChrome } from '../../shellChrome';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly layout?: string;
};

export const HomePlaceScene = ({ theme, layout }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    installSceneDatabase(
      layout === undefined
        ? {}
        : { workspaceValues: { [WORKSPACE_ID]: { 'home.layout': layout } } },
    );
    seedBoardScene();
    seedPolicyScene({ workspaceId: WORKSPACE_ID });
    seedStudioChrome();
    useAppStore.setState({
      currentSessionId: null,
      openHomeWorkspaceId: WORKSPACE_ID,
    });
    setIsReady(true);
  }, [theme, layout]);

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
