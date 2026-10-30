import { brandId, type ProviderRunId, type TurnEvent, type TurnState } from '@goodboy/types';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

const RUN_FOUR = brandId<ProviderRunId>({ value: 'mock-reading-run-4' });

export const SENT_QUESTION =
  'Does the guard also cover two simultaneous webhooks for the same credit?';

const REPLY = [
  'I checked the case you described. Two simultaneous webhooks for the same credit both pass the check before either one writes, so each posts a credit. The guard needs to claim the delivery id before the ledger write, not after it.',
  'The smallest change is a unique claim on the delivery id inside one transaction: the first webhook inserts the claim and writes the credit, the second one',
].join('\n\n');

export const SENT_EVENTS: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_FOUR,
    text: SENT_QUESTION,
    at: clock.iso({ at: '2026-10-13T12:21:00.000Z' }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_FOUR,
    delta: REPLY,
    at: clock.iso({ at: '2026-10-13T12:21:06.000Z' }),
  },
];

export const SENT_TURN: TurnState = {
  kind: 'running',
  runId: RUN_FOUR,
  startedAt: clock.iso({ at: '2026-10-13T12:21:00.000Z' }),
};
