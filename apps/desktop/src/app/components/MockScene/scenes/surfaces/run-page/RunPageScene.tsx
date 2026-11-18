import { useEffect, useState } from 'react';
import { leadPermissionsOf } from '@goodboy/core/auto';
import { AutoReleaseContext } from '../../../../../../features/auto/autoReleaseContext';
import { SessionWorkspace } from '../../../../../../features/session/components/SessionWorkspace';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { autoChildRoutingOf } from '../../../../../../features/auto/autoChildRoutingOf';
import { agentPlace } from '../../../../../../store/slices/navigation/place';
import type { AgentId } from '@goodboy/types';
import { seedActivityRunScene } from '../../activityRunSeed';
import { leadNextStepView } from './leadNextStepView';
import { ShellFrame, seedShellChrome } from '../../shellChrome';
import { runPageChildEventsOf } from './runPageChildEventsOf';
import {
  AUTO_PLAN,
  AUTO_PLAN_STORED,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  autoSceneOf,
  type AutoSceneData,
  type AutoSceneState,
} from '../../u24/autoSceneSeed';

type ExtendParams = {
  readonly scene: AutoSceneData;
};

type Props = {
  readonly state: AutoSceneState;
  readonly theme: 'dark' | 'light';
  readonly isLead?: boolean;
  readonly extend?: (params: ExtendParams) => AutoSceneData;
  readonly shownAgentId?: AgentId;
};

const keepScene = ({ scene }: ExtendParams): AutoSceneData => scene;

const LEAD_PERMISSIONS = leadPermissionsOf({
  leadRows: {},
  defaultRows: {},
  sessionLevel: 'plan',
  workspaceLevel: null,
  isPlanApprovalOff: false,
  isWorkFlowOn: true,
  spendLimitUsd: 10,
});

export const RunPageScene = ({
  state,
  theme,
  isLead = false,
  extend = keepScene,
  shownAgentId = AUTO_ROOT_ID,
}: Props) => {
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
    const seeded = extend({ scene: autoSceneOf({ state }) });
    const scene = isLead ? { ...seeded, view: leadNextStepView({ view: seeded.view }) } : seeded;
    const agents = scene.agents.map((agent) => {
      const delegation = [...scene.view.delegations]
        .reverse()
        .find((candidate) => candidate.childAgentId === agent.id);
      return delegation === undefined ? agent : { ...agent, ...autoChildRoutingOf({ delegation }) };
    });
    useAppStore.setState({
      sessionPhaseRuns: { [AUTO_SESSION.id]: agents },
      agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
      agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic' },
      agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5' },
      agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
      autoTreeViews: { [AUTO_SESSION.id]: [scene.view] },
      loadAutoTrees: async () => undefined,
      readLeadPermissions: async () => LEAD_PERMISSIONS,
      selectedAgentId: { [AUTO_SESSION.id]: shownAgentId },
      agentTurnState: { [AUTO_ROOT_ID]: scene.rootTurn },
      agentQueue: { [AUTO_ROOT_ID]: [] },
      transcripts:
        shownAgentId === AUTO_ROOT_ID
          ? { [AUTO_ROOT_ID]: scene.events }
          : {
              [AUTO_ROOT_ID]: scene.events,
              [shownAgentId]: runPageChildEventsOf({ agentId: shownAgentId }),
            },
      loadAgentTranscript: async () => undefined,
      sessionPlans: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN] : [] },
      sessionArtifacts: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [] },
      sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
      sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
      sessionEvents: { [AUTO_SESSION.id]: [] },
      drawer: null,
      navigate: useAppStore.getInitialState().navigate,
    });
    useAppStore.getInitialState().navigate({
      to: agentPlace({ sessionId: AUTO_SESSION.id, agentId: shownAgentId }),
      mode: 'replace',
    });
    setIsReady(true);
  }, [state, theme, isLead, extend, shownAgentId]);

  if (!isReady) {
    return null;
  }
  return (
    <AutoReleaseContext.Provider value>
      <ShellFrame
        session={AUTO_SESSION}
        main={
          <div className="relative h-full w-full">
            <SessionWorkspace session={AUTO_SESSION} />
          </div>
        }
      />
    </AutoReleaseContext.Provider>
  );
};
