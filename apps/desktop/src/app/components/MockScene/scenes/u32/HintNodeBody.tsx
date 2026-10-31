import { OrchestratedChecklist } from '../../../../../features/session/components/OrchestratedRun/OrchestratedChecklist';
import { OrchestratedComposer } from '../../../../../features/session/components/OrchestratedRun/OrchestratedComposer';
import { HintRowStateProvider } from '../../../../../features/session/components/OrchestratedRun/HintRowStateProvider';
import { useRunView } from '../../../../../features/session/components/AgentTree/useRunView';
import { HINT_NODE_SEED } from './hintNodeSeed';

export const HintNodeBody = () => {
  const { session, run, workflow } = HINT_NODE_SEED;
  const view = useRunView({ session, run, workflow });
  return (
    <HintRowStateProvider>
      <div className="flex min-w-0 flex-col gap-4">
        <OrchestratedChecklist session={session} view={view} />
        <OrchestratedComposer sessionId={session.id} run={run} agents={view.agents} />
      </div>
    </HintRowStateProvider>
  );
};
