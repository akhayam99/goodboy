import { useEffect, useState } from 'react';
import { AutoDelegationLines } from '../../../../../features/auto/chat/AutoDelegationLines';
import { useAppStore } from '../../../../../store';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { seedNextStep } from './nextStepSeed';

const FRAME_WIDTH = 680;

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
  return (
    <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
      <div className="p-6">
        <AutoDelegationLines
          sessionId={AUTO_SESSION.id}
          view={view}
          delegations={view.delegations}
          agents={agents}
          onOpenChild={() => undefined}
          onOpenArtifact={() => undefined}
        />
      </div>
    </div>
  );
};
