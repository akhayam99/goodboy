import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { seedActivityRunScene } from '../activityRunSeed';
import { AUTO_PLAN, AUTO_PLAN_STORED, AUTO_ROOT_ID, AUTO_SESSION } from '../u24/autoSceneSeed';
import { chatReadingSceneOf } from './chatReadingSeed';
import { SENT_EVENTS, SENT_TURN } from './chatAnchoringSeed';

const FRAME_WIDTH = 1100;
const FRAME_HEIGHT = 880;
const SENT_FRAME_HEIGHT = 560;

type Props = {
  readonly isSent?: boolean;
};

export const ChatReadingScene = ({ isSent = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const scene = chatReadingSceneOf();
  const agent = scene.agents.find((candidate) => candidate.id === AUTO_ROOT_ID) ?? null;

  useEffect(() => {
    const data = chatReadingSceneOf();
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

  useEffect(() => {
    if (!isReady || !isSent) {
      return;
    }
    const timer = setTimeout(() => {
      const data = chatReadingSceneOf();
      useAppStore.setState({
        agentTurnState: { [AUTO_ROOT_ID]: SENT_TURN },
        transcripts: { [AUTO_ROOT_ID]: [...data.events, ...SENT_EVENTS] },
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [isReady, isSent]);

  if (!isReady || agent === null) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <div
        data-shot
        style={{ width: FRAME_WIDTH, height: isSent ? SENT_FRAME_HEIGHT : FRAME_HEIGHT }}
      >
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
