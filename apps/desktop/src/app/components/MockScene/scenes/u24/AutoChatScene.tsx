import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { AutoLevel } from '../../../SideColumn/AutoLevel';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { seedActivityRunScene } from '../activityRunSeed';
import {
  AUTO_PLAN,
  AUTO_PLAN_ID,
  AUTO_PLAN_STORED,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  PLANNER_ID,
  autoSceneOf,
  type AutoSceneState,
} from './autoSceneSeed';

type Props = {
  readonly state: AutoSceneState;
  readonly isPlanOpen?: boolean;
  readonly selected?: 'root' | 'planner';
};

export const AutoChatScene = ({ state, isPlanOpen = false, selected = 'root' }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);
  const selectedId: AgentId = selected === 'root' ? AUTO_ROOT_ID : PLANNER_ID;
  const data = autoSceneOf({ state });
  const agent = data.agents.find((candidate) => candidate.id === selectedId) ?? null;

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
      selectedAgentId: { [AUTO_SESSION.id]: selectedId },
      agentPane: { [AUTO_SESSION.id]: 'transcript' },
      agentTurnState: { [AUTO_ROOT_ID]: scene.rootTurn },
      transcripts: { [AUTO_ROOT_ID]: scene.events },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN] : [] },
      sessionArtifacts: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [] },
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: isPlanOpen
        ? {
            kind: 'artifact-document',
            sessionId: AUTO_SESSION.id,
            payload: { artifactId: AUTO_PLAN_ID, revision: null },
          }
        : null,
    });
    setIsReady(true);
  }, [state, isPlanOpen, selectedId]);

  if (!isReady || agent === null) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <main className="flex h-screen bg-background text-foreground">
        <nav
          aria-label="Sidebar"
          className="flex h-full w-60 shrink-0 flex-col border-r border-border-soft pt-1"
        >
          <AutoLevel session={AUTO_SESSION} />
        </nav>
        <DrawerColumn
          main={
            <AgentDetailPane
              session={AUTO_SESSION}
              agent={agent}
              isChatActive
              onBack={() => undefined}
            />
          }
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          sizing={sizing}
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </AutoReleaseContext.Provider>
  );
};
