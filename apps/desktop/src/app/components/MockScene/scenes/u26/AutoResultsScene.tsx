import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { AutoLevel } from '../../../SessionRail/AutoLevel';
import { AutoReleaseContext } from '../../../../../features/auto/autoReleaseContext';
import { AgentDetailPane } from '../../../../../features/session/components/AgentDetailPane';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { seedActivityRunScene } from '../activityRunSeed';
import {
  RESULTS_AGENTS,
  RESULTS_EVENTS,
  RESULTS_IDLE_AT,
  RESULTS_ROOT_ID,
  RESULTS_SESSION,
  RESULTS_VIEW,
} from './autoResultsSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

export const AutoResultsScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((current) => current.drawer !== null);
  const agent = RESULTS_AGENTS.find((candidate) => candidate.id === RESULTS_ROOT_ID) ?? null;

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    useAppStore.setState({
      sessionPhaseRuns: { [RESULTS_SESSION.id]: RESULTS_AGENTS },
      agentKindOverride: { [RESULTS_ROOT_ID]: 'auto' },
      agentProviderOverride: { [RESULTS_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [RESULTS_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [RESULTS_ROOT_ID]: 'medium' },
      autoTreeViews: { [RESULTS_SESSION.id]: [RESULTS_VIEW] },
      loadAutoTrees: async () => undefined,
      selectedAgentId: { [RESULTS_SESSION.id]: RESULTS_ROOT_ID },
      agentPane: { [RESULTS_SESSION.id]: 'transcript' },
      agentTurnState: { [RESULTS_ROOT_ID]: { kind: 'idle', lastActivityAt: RESULTS_IDLE_AT } },
      transcripts: { [RESULTS_ROOT_ID]: RESULTS_EVENTS },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [RESULTS_SESSION.id]: [] },
      sessionArtifacts: { [RESULTS_SESSION.id]: [] },
      sessionOpenQuestions: { [RESULTS_SESSION.id]: [] },
      sessionAnsweredQuestions: { [RESULTS_SESSION.id]: [] },
      sessionEvents: { [RESULTS_SESSION.id]: [] },
      drawer: null,
    });
    setIsReady(true);
  }, [theme]);

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
          <AutoLevel session={RESULTS_SESSION} />
        </nav>
        <DrawerColumn
          main={
            <AgentDetailPane
              session={RESULTS_SESSION}
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
