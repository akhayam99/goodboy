import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { SpawnedPanel } from '../../../SpawnedPanel';
import { seedActivityRunScene } from '../activityRunSeed';
import { TREE_SESSION } from '../u27/agentsTreeSeed';
import { RAIL_SEED, RAIL_SELECTED_AGENT_ID, RAIL_TURN_SPANS } from './railSeed';

const FRAME_WIDTH = 680;

export const RailScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    useAppStore.setState((state) => ({
      sessions: [TREE_SESSION],
      sessionPhaseRuns: { [TREE_SESSION.id]: RAIL_SEED.agents },
      sessionTurnSpans: { [TREE_SESSION.id]: RAIL_TURN_SPANS },
      agentKindOverride: Object.fromEntries(RAIL_SEED.rootIds.map((id) => [id, 'auto'])),
      autoTreeViews: { [TREE_SESSION.id]: RAIL_SEED.views },
      loadAutoTrees: async () => undefined,
      transcripts: {},
      loadAgentTranscript: async () => undefined,
      selectedAgentId: { [TREE_SESSION.id]: RAIL_SEED.selectedRootId },
      activeLens: { ...state.activeLens, [TREE_SESSION.id]: 'auto' },
      focusedWorkflowRunId: {},
      drawer: {
        kind: 'spawned',
        sessionId: TREE_SESSION.id,
        payload: { agentId: RAIL_SELECTED_AGENT_ID },
      },
    }));
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
      <div className="flex justify-end p-6">
        <section className="flex w-80 shrink-0 flex-col border border-border-soft">
          <SpawnedPanel sessionId={TREE_SESSION.id} onClose={() => undefined} />
        </section>
      </div>
    </div>
  );
};
