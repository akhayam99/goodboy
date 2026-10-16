import { useState } from 'react';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { TailLine } from '../../../../../../features/live-state/TailLine';
import { TAIL_ACTION } from '../../../../../../features/live-state/tailAction';
import type { TailActionId, TailFacts } from '../../../../../../features/live-state/tailFacts';
import { sceneClock } from '../../../sceneClock';

export type TailSceneState =
  'working' | 'waiting' | 'queued' | 'paused' | 'failed' | 'stopped' | 'run' | 'cleanup';

type Props = {
  readonly state: TailSceneState;
};

const CLOCK = sceneClock({ anchor: '2026-10-16T09:01:12.000Z' });
const STARTED = CLOCK.iso({ at: '2026-10-16T09:00:00.000Z' });

const FACTS: Record<TailSceneState, TailFacts> = {
  working: {
    state: 'working',
    phrase: 'Running pnpm in payments-api',
    startedAt: STARTED,
    actions: [TAIL_ACTION.stop],
  },
  waiting: {
    state: 'waiting',
    phrase: 'Waiting for Implementer',
    startedAt: STARTED,
    actions: [TAIL_ACTION.stopAuto],
  },
  queued: {
    state: 'queued',
    phrase: 'Editing export.ts',
    startedAt: STARTED,
    actions: [TAIL_ACTION.stop],
  },
  paused: {
    state: 'paused',
    phrase: 'Paused at the limit: $4.80 of $5.00',
    startedAt: null,
    actions: [TAIL_ACTION.raiseLimit, TAIL_ACTION.changeLimit],
  },
  failed: {
    state: 'failed',
    phrase: 'Failed: the provider exited without a response.',
    startedAt: null,
    actions: [TAIL_ACTION.retry, TAIL_ACTION.viewTranscript],
  },
  stopped: {
    state: 'stopped',
    phrase: 'Stopped by you at 09:01',
    startedAt: null,
    actions: [TAIL_ACTION.continue],
  },
  run: {
    state: 'working',
    phrase: 'Step 3 of 4 · Tester is working',
    startedAt: STARTED,
    actions: [TAIL_ACTION.stopStep],
  },
  cleanup: {
    state: 'failed',
    phrase: 'Could not close: 2 uncommitted files.',
    startedAt: null,
    actions: [TAIL_ACTION.retry],
  },
};

export const TailScene = ({ state }: Props) => {
  const [lastAction, setLastAction] = useState<TailActionId | null>(null);
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
      <TailLine facts={FACTS[state]} onAction={setLastAction} />
      <p role="status" className={TEXT_ROLE.hint}>
        {lastAction === null ? '' : `Pressed ${lastAction}`}
      </p>
    </div>
  );
};
