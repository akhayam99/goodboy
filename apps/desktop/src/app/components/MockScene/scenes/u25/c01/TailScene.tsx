import { useState } from 'react';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { TailLine } from '../../../../../../features/live-state/TailLine';
import type { TailActionId } from '../../../../../../features/live-state/tailFacts';
import { WorkTimeContext } from '../../../../../../features/workTreeModel/workTimeSource';
import { tailSceneFacts, type TailSceneState } from './tailSceneFacts';
import { TAIL_SCENE_STEP } from './tailSceneStep';

type Props = {
  readonly state: TailSceneState;
};

export const TailScene = ({ state }: Props) => {
  const [lastAction, setLastAction] = useState<TailActionId | null>(null);
  const facts = tailSceneFacts({ state });
  return (
    <div className="flex w-[720px] flex-col gap-4 bg-background p-6 text-ui">
      <p className={cn('text-read', TEXT_ROLE.label)}>
        I will stream the ledger rows to CSV in payments-api and run its tests.
      </p>
      {state === 'queued' ? (
        <p className={cn('self-end rounded-lg bg-fill px-3 py-2', TEXT_ROLE.label)}>
          Use pnpm, not yarn. <span className={TEXT_ROLE.hint}>Queued</span>
        </p>
      ) : null}
      {facts === null ? null : (
        <WorkTimeContext.Provider value={TAIL_SCENE_STEP.source}>
          <TailLine facts={facts} onAction={setLastAction} />
        </WorkTimeContext.Provider>
      )}
      <p role="status" className={TEXT_ROLE.hint}>
        {lastAction === null ? '' : `Pressed ${lastAction}`}
      </p>
    </div>
  );
};
