import { brandId, type AgentId } from '@goodboy/types';

export const LEDGER_ID = brandId<AgentId>({ value: 'mock-auto-ledger' });

export const GUARD_BRANCH = 'hl/event-guard';
export const TESTS_BRANCH = 'hl/replay-tests';

export const ORCHESTRATE_GOAL =
  'Make every webhook consumer idempotent across payments-api and ledger-core, with a replay test';

export const AUTO_STORY = {
  first:
    'This touches payments-api and ledger-core, so I will not edit anything myself. A Planner reads both repositories first on Opus 5.5, and nothing is written until you approve its plan.',
  second:
    'The Planner finished a 3 part plan: one event id guard in front of every webhook consumer in payments-api, a replay test that sends each event three times, and the same guard on the ledger-core consumer. Approve it and I start three helpers, two on payments-api and one on ledger-core.',
  third:
    'Plan approved. Three helpers start on Sonnet 5.5, each on its own branch: an Implementer and a Tester on payments-api, a Ledger implementer on ledger-core.',
  final:
    'All three helpers finished. Every webhook consumer in payments-api and ledger-core now skips an event id it already handled, and the replay test sends each event three times and sees one effect. Review the diff before anything is pushed.',
  implementerNote:
    'Reading the webhook consumers first. Then one guard keyed on the event id goes in front of each of them.',
  testerNote:
    'Replaying evt_7Qm2 and two more events three times each on a second payments-api branch. Every event takes effect once and the repeats answer 200.',
  ledgerNote:
    'Checking the ledger-core consumer. A repeated event id is refused before it writes a posting.',
  plannerTask: 'Plan one event id guard for every webhook consumer.',
  implementerTask: 'Add one event id guard in front of every webhook consumer in payments-api.',
  implementerSummary:
    'Every webhook consumer in payments-api skips an event id it already handled.',
  testerTask: 'Replay each event three times on a second payments-api branch.',
  testerSummary: 'Each replayed event takes effect once. 6 tests pass.',
  ledgerTask: 'Guard the ledger-core consumer on the event id.',
  ledgerSummary: 'A repeated event id is refused before ledger-core writes a posting.',
  reviewerTask: 'Review the three branches before you push.',
  planTitle: 'Idempotent webhook consumers',
  planBody: [
    '## Goal\n\nEvery webhook consumer handles an event id once, however many times the processor redelivers it. One guard keyed on the event id sits in front of each consumer, so a repeat never reaches the code that writes.',
    '## Approach\n\nThree helpers, each on its own branch. An Implementer puts the guard in front of the payments-api consumers. A Tester replays each event three times on a second payments-api branch. A Ledger implementer guards the ledger-core consumer the same way.',
  ].join('\n\n'),
} as const;
