import { brandId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { sceneClock } from '../../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

type Params = {
  readonly agentId: string;
};

const BRIEF =
  'Post one credit per retry in postCredit and applyCredit. Build the idempotency key once per credit, before the retry loop, and make applyCredit return the first result for a key it has seen. Do not touch the webhook handler in notify-relay.';

const REPLY =
  'Read postCredit and applyCredit in payments-api. The key is built inside the retry loop, so every attempt gets a new one. Moving it above the loop and keying applyCredit on it now.';

export const runPageChildEventsOf = ({ agentId }: Params): ReadonlyArray<TurnEvent> => {
  const runId = brandId<ProviderRunId>({ value: `mock-run-${agentId}` });
  return [
    { kind: 'user_text', runId, text: BRIEF, at: clock.iso({ at: '2026-10-13T12:08:00.000Z' }) },
    {
      kind: 'assistant_text',
      runId,
      delta: REPLY,
      at: clock.iso({ at: '2026-10-13T12:09:00.000Z' }),
    },
  ];
};
