import { OrchestratedChecklist } from '../../../../../features/session/components/OrchestratedRun/OrchestratedChecklist';
import { OrchestratedComposer } from '../../../../../features/session/components/OrchestratedRun/OrchestratedComposer';
import { useRunView } from '../../../../../features/session/components/AgentTree/useRunView';
import { HINT_NODE_RUN, HINT_NODE_SESSION, HINT_NODE_WORKFLOW } from './hintNodeSeed';

export const HintNodeBody = () => {
  const view = useRunView({
    session: HINT_NODE_SESSION,
    run: HINT_NODE_RUN,
    workflow: HINT_NODE_WORKFLOW,
  });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <OrchestratedChecklist session={HINT_NODE_SESSION} view={view} />
      <OrchestratedComposer
        sessionId={HINT_NODE_SESSION.id}
        run={HINT_NODE_RUN}
        agents={view.agents}
      />
    </div>
  );
};
