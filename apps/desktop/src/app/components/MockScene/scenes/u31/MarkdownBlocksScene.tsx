import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { seedActivityRunScene } from '../activityRunSeed';
import { AUTO_PLAN, AUTO_PLAN_STORED, AUTO_ROOT_ID, AUTO_SESSION } from '../u24/autoSceneSeed';
import { markdownBlocksSceneOf } from './markdownBlocksSeed';

const FRAME_WIDTH = 680;
const FRAME_HEIGHT = 1400;

export const MarkdownBlocksScene = () => {
  const [isReady, setIsReady] = useState(false);
  const scene = markdownBlocksSceneOf();
  const agent = scene.agents.find((candidate) => candidate.id === AUTO_ROOT_ID) ?? null;

  useEffect(() => {
    const data = markdownBlocksSceneOf();
    seedActivityRunScene();
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SESSION.id]: data.agents },
      agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
      agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
      autoTreeViews: { [AUTO_SESSION.id]: [data.view] },
      loadAutoTrees: async () => undefined,
      selectedAgentId: { [AUTO_SESSION.id]: AUTO_ROOT_ID },
      agentPane: { [AUTO_SESSION.id]: 'transcript' },
      agentTurnState: { [AUTO_ROOT_ID]: data.rootTurn },
      transcripts: { [AUTO_ROOT_ID]: data.events },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [AUTO_SESSION.id]: [AUTO_PLAN] },
      sessionArtifacts: { [AUTO_SESSION.id]: [AUTO_PLAN_STORED] },
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: null,
    });
    setIsReady(true);
  }, []);

  if (!isReady || agent === null) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div data-shot style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}>
        <div className="flex h-full min-h-0 flex-col bg-background p-4 text-foreground">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-background ring-1 ring-border-soft">
            <AgentDetailPane
              session={AUTO_SESSION}
              agent={agent}
              isChatActive
              onBack={() => undefined}
            />
          </div>
        </div>
      </div>
    </AutoReleaseContext.Provider>
  );
};
