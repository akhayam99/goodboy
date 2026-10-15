import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { seedActivityRunScene } from '../activityRunSeed';
import { AUTO_ROOT_ID, AUTO_SESSION, autoSceneOf, type AutoSceneState } from './autoSceneSeed';

type Props = {
  readonly state: AutoSceneState;
};

export const AutoOverviewScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    const scene = autoSceneOf({ state });
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SESSION.id]: scene.agents },
      agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
      agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
      autoTreeViews: { [AUTO_SESSION.id]: [scene.view] },
      loadAutoTrees: async () => undefined,
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionArtifacts: { [AUTO_SESSION.id]: [] },
      sessionPlans: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
    });
    setIsReady(true);
  }, [state]);

  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <ScrollFade className="min-h-0 flex-1">
          <div className="px-6 py-4">
            <SessionOverviewPane session={AUTO_SESSION} onSelectLens={() => undefined} />
          </div>
        </ScrollFade>
      </main>
    </AutoReleaseContext.Provider>
  );
};
