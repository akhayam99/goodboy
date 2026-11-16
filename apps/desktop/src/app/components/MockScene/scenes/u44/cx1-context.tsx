import type { ContextSlot } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ActivityRunScene } from '../ActivityRunScene';
import { SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

const RICH_SUMMARY = [
  '#### Learned',
  '- The duplicate credit comes from `handleDelivery` in `apps/payments-api/src/webhooks/deliveries/handleDelivery.ts`, which posts before it checks `event.id`, so a redelivery after a slow `ledger-core` write looks like a second payment.',
  '- Redeliveries fire whenever payments-api acknowledges after the 10 second window; the processor retries with the same `event.id` but a fresh `delivery_id`.',
  '- `useDeliveryRetries` in `apps/console/src/features/deliveries/hooks/useDeliveryRetries/index.ts` polls `/v2/deliveries/:id/attempts` every 5 seconds and never stops on a 404.',
  '- The ledger-core client already retries twice with `--max-attempts=2`, so a third retry from us doubles the load on a slow write.',
  '- `idempotency_key` must live in the same transaction as the credit, or a crash between them leaves a key with no credit.',
  '- notify-relay reads delivery state through `GET /internal/deliveries/stuck`, which only exists behind the `delivery_state_v2` flag.',
  '- The Harborline staging tenant replays real traffic at twice the rate, so a fix that holds there holds in production.',
  '',
  '#### State',
  '- Dedupe check and the `idempotency_key` column are live in payments-api behind `webhook_dedupe`; 42 tests pass on `handleDelivery`.',
  '- Backfill for settled events is written in `scripts/backfill/settledEvents.ts` and stays read only.',
  '- Blocked: notify-relay cannot show a stuck delivery until `delivery_state_v2` is on in staging, and the flag needs an owner on the Northwind side.',
  '',
  '#### Next',
  '- Ask the Northwind team to turn on `delivery_state_v2` in staging.',
  '- Wire the retry state into notify-relay through `GET /internal/deliveries/stuck` and show the banner after the third failed retry.',
  '- Flip the backfill out of read only after a week of live traffic.',
  '- Decide whether support can replay a delivery by hand.',
].join('\n');

const seedRichSummary = () => {
  seedActivityRunScene();
  useAppStore.setState((state) => ({
    sessionSlots: {
      ...state.sessionSlots,
      [SESSION_ID]: (state.sessionSlots[SESSION_ID] ?? []).map((slot): ContextSlot =>
        slot.key === 'last_output_summary' ? { ...slot, value: RICH_SUMMARY } : slot,
      ),
    },
  }));
};

export const U44_CX1_CONTEXT_SCENES = {
  'cx1-context-summary': () => (
    <ActivityRunScene contextSection="summary" seedRuns={seedRichSummary} />
  ),
};
