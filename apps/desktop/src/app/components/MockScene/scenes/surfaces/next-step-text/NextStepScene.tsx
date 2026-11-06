import { useEffect, useState } from 'react';
import { AutoNextAction } from '../../../../../../features/auto/chat/AutoNextAction';
import { dockNextStepOf } from '../../../../../../features/auto/chat/dockNextStepOf';
import { useAppStore } from '../../../../../../store';
import { AUTO_SESSION } from '../../u24/autoSceneSeed';
import { seedNextStep } from './nextStepSeed';

const FRAME_WIDTH = 680;
const NO_UNTOLD = {};

export const NextStepScene = () => {
  const [isReady, setIsReady] = useState(false);
  const view = useAppStore((state) => state.autoTreeViews[AUTO_SESSION.id]?.[0]);
  const agents = useAppStore((state) => state.sessionPhaseRuns[AUTO_SESSION.id]);
  useEffect(() => {
    seedNextStep();
    setIsReady(true);
  }, []);
  if (!isReady || view === undefined || agents === undefined) {
    return null;
  }
  const nextStep = dockNextStepOf({ view, agents, untold: NO_UNTOLD });
  if (nextStep === null) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
      <div className="p-6">
        <AutoNextAction
          sessionId={AUTO_SESSION.id}
          rootAgentId={view.tree.rootAgentId}
          action={nextStep.action}
          untold={null}
          onUntold={() => undefined}
        />
      </div>
    </div>
  );
};
