import { useEffect, useState } from 'react';
import type { Agent, AgentId } from '@goodboy/types';
import { AppShell, ScrollFade } from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { LogPane } from '../../../../../features/session/central/log/LogPane';
import { shellArrangement } from '../../../../shellArrangement';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

const arrangement = shellArrangement({
  hasWorkspace: true,
  isSidebarCollapsed: false,
});

const AUTO_AGENT_ID: AgentId = JSON.parse(JSON.stringify('mock-u26-auto-agent'));

type Props = {
  readonly theme: 'dark' | 'light';
};

type AutoParams = {
  readonly from: Agent;
};

const autoAgentOf = ({ from }: AutoParams): Agent => {
  const { stepId: _stepId, workflowRunId: _runId, parentAgentId: _parentId, ...rest } = from;
  return {
    ...rest,
    id: AUTO_AGENT_ID,
    kind: 'auto',
    name: 'Keep the notify-relay retries green',
    ordinal: 40,
    outputSummary: 'Watched the retry queue and found nothing stuck.',
  };
};

const seedKinds = () => {
  seedActivityRunScene();
  useAppStore.setState((state) => {
    const agents = state.sessionPhaseRuns[SESSION_ID] ?? [];
    const first = agents[0];
    const workflows = state.sessionWorkflows[SESSION_ID] ?? [];
    const library = workflows.map((workflow, index) =>
      index === workflows.length - 1 ? { ...workflow, origin: 'library' as const } : workflow,
    );
    return {
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [SESSION_ID]: first === undefined ? agents : [...agents, autoAgentOf({ from: first })],
      },
      sessionWorkflows: { ...state.sessionWorkflows, [SESSION_ID]: library },
    };
  });
};

export const ActivityKindsScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedKinds();
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <div className="[&>div]:w-full" style={{ width: 1440 }}>
      <AppShell
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={
          <ScrollFade className="min-h-0 flex-1">
            <div className="px-6 py-4">
              <LogPane session={SESSION} />
            </div>
          </ScrollFade>
        }
      />
    </div>
  );
};
