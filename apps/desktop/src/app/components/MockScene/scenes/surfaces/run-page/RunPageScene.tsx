import { useEffect, useState } from 'react';
import { AutoReleaseContext } from '../../../../../../features/auto/autoReleaseContext';
import { SessionWorkspace } from '../../../../../../features/session/components/SessionWorkspace';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { agentPlace } from '../../../../../../store/slices/navigation/place';
import { SETTING_WORK_ENABLED } from '../../../../../../shared/lib/workSetting';
import { seedActivityRunScene } from '../../activityRunSeed';
import { leadNextStepView } from './leadNextStepView';
import { ShellFrame, seedShellChrome } from '../../shellChrome';
import {
  AUTO_PLAN,
  AUTO_PLAN_STORED,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  autoSceneOf,
  type AutoSceneState,
} from '../../u24/autoSceneSeed';

type Props = {
  readonly state: AutoSceneState;
  readonly theme: 'dark' | 'light';
  readonly isLead?: boolean;
};

export const RunPageScene = ({ state, theme, isLead = false }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    seedShellChrome({
      session: AUTO_SESSION,
      siblings: [],
      branches: {},
      telemetryAt: AUTO_SESSION.updatedAt,
      lens: null,
    });
    const seeded = autoSceneOf({ state });
    const scene = isLead ? { ...seeded, view: leadNextStepView({ view: seeded.view }) } : seeded;
    if (isLead) {
      useAppStore.setState((current) => ({
        settings: { ...current.settings, [SETTING_WORK_ENABLED]: 'true' },
      }));
    }
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SESSION.id]: scene.agents },
      agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
      agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
      autoTreeViews: { [AUTO_SESSION.id]: [scene.view] },
      loadAutoTrees: async () => undefined,
      selectedAgentId: { [AUTO_SESSION.id]: AUTO_ROOT_ID },
      agentTurnState: { [AUTO_ROOT_ID]: scene.rootTurn },
      agentQueue: { [AUTO_ROOT_ID]: [] },
      transcripts: { [AUTO_ROOT_ID]: scene.events },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN] : [] },
      sessionArtifacts: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [] },
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: null,
    });
    useAppStore.getInitialState().navigate({
      to: agentPlace({ sessionId: AUTO_SESSION.id, agentId: AUTO_ROOT_ID }),
      mode: 'replace',
    });
    setIsReady(true);
  }, [state, theme, isLead]);

  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <ShellFrame
        session={AUTO_SESSION}
        sidebar="expanded"
        main={
          <div className="relative h-full w-full">
            <SessionWorkspace session={AUTO_SESSION} />
          </div>
        }
      />
    </AutoReleaseContext.Provider>
  );
};
