import { brandId } from '@goodboy/types';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { TranscriptSceneHost } from './TranscriptSceneHost';

const DELIVERY_TEXT =
  'STATE OF THIS CONVERSATION\nSpent 3.82 USD. Reserved 0.00 USD. Left 1.18 USD.\n\nMESSAGES FROM THE USER, OLDEST FIRST\n- The dev server still fails: next: command not found.';

const RUN_ID = brandId<ProviderRunId>({ value: 'mock-delivery-run' });
const ECHO_RUN_ID = brandId<ProviderRunId>({ value: 'mock-delivery-echo' });
const AT = brandId<IsoDateTime>({ value: '2026-09-07T09:00:00.000Z' });

const EVENTS: ReadonlyArray<TurnEvent> = [
  {
    kind: 'operator_text',
    runId: ECHO_RUN_ID,
    text: 'The dev server still fails: next: command not found.',
    at: AT,
  },
  { kind: 'user_text', runId: RUN_ID, text: DELIVERY_TEXT, deliveredBy: 'auto', at: AT },
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta: 'Reinstalling dependencies in payments-api, then rerunning the dev server.',
    at: AT,
  },
];

export const TranscriptDeliveryScene = () => <TranscriptSceneHost events={EVENTS} />;
