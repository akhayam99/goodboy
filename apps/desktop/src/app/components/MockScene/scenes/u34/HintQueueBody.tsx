import { ScrollFade } from '@goodboy/ui';
import { OrchestratedChecklist } from '../../../../../features/session/components/OrchestratedRun/OrchestratedChecklist';
import { OrchestratedComposer } from '../../../../../features/session/components/OrchestratedRun/OrchestratedComposer';
import { HintRowStateProvider } from '../../../../../features/session/components/OrchestratedRun/HintRowStateProvider';
import { useRunView } from '../../../../../features/session/components/AgentTree/useRunView';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { HINT_NODE_SEED } from '../surfaces/hint-node/hintNodeSeed';

const FRAME_WIDTH = 680;
const FRAME_HEIGHT = 720;

export const HintQueueBody = () => {
  const session =
    useAppStore((state) => sessionById(state.sessions, HINT_NODE_SEED.sessionId)) ??
    HINT_NODE_SEED.session;
  const run = session.workflowRuns[0] ?? HINT_NODE_SEED.run;
  const view = useRunView({ session, run, workflow: HINT_NODE_SEED.workflow });
  return (
    <HintRowStateProvider>
      <div
        data-shot
        className="flex flex-col bg-background text-foreground"
        style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
      >
        <div data-hint-queue-page="" className="flex min-h-0 flex-1 flex-col">
          <ScrollFade className="min-h-0 flex-1" viewportClassName="p-6">
            <OrchestratedChecklist session={session} view={view} />
          </ScrollFade>
        </div>
        <div className="flex-none p-6">
          <OrchestratedComposer sessionId={session.id} run={run} agents={view.agents} />
        </div>
      </div>
    </HintRowStateProvider>
  );
};
