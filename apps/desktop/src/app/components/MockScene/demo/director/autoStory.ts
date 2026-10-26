import { brandId, type AgentId } from '@goodboy/types';

export const LEDGER_ID = brandId<AgentId>({ value: 'mock-auto-ledger' });

export const AUTO_STORY = {
  first:
    'This touches payments-api and ledger-core, so I will not edit anything myself. A Planner reads both repositories first on Opus 5.5, and nothing is written until you approve its plan.',
  second:
    'The Planner finished a 3 part plan: key the credit on the processor event id, check it inside the transaction, replay one event three times. Approve it and I start three helpers, two on payments-api and one on ledger-core.',
  third:
    'Plan approved. Three helpers start on Sonnet 5.5, each on its own branch: an Implementer and a Tester on payments-api, a Ledger implementer on ledger-core.',
  final:
    'All three helpers finished. payments-api posts one credit per event id and ledger-core keeps one posting per event id, so the replay test posts one event three times against one credit. Review the diff before anything is pushed.',
  implementerNote:
    'Reading applyWebhook.ts first. Then the credit moves behind the event id check, inside the transaction.',
  testerNote:
    'Replaying evt_7Qm2 three times on a second payments-api branch. One credit posts and the two repeats answer 200.',
  ledgerNote:
    'Checking the postings table in ledger-core. One posting per event id, so a repeat is refused before it writes.',
  plannerTask: 'Plan the fix for the double credit on a retried webhook.',
  implementerTask: 'Check the event id inside the credit transaction in payments-api.',
  implementerSummary: 'applyWebhook checks the event id inside the credit transaction.',
  testerTask: 'Replay one event three times on a second payments-api branch.',
  testerSummary: 'One event replayed three times posts one credit. 3 tests pass.',
  ledgerTask: 'Keep one posting per event id in ledger-core.',
  ledgerSummary: 'A repeated event id is refused before it writes a posting.',
  reviewerTask: 'Review the three branches before you push.',
  planBody: [
    '## Goal\n\nA retried webhook must credit the account once. Key the credit on the processor event id and check the key inside the credit transaction, so two deliveries cannot both pass.',
    '## Approach\n\nThree helpers, each on its own branch. An Implementer changes applyWebhook in payments-api. A Tester replays one event three times on a second payments-api branch. A Ledger implementer keeps one posting per event id in ledger-core.',
  ].join('\n\n'),
} as const;
