export const STORY_ISSUE = {
  identifier: 'HBL-412',
  title: 'Retried webhooks credit an account twice',
  description: [
    'When the processor redelivers a webhook that payments-api acknowledged late, the account is credited a second time and ledger-core records a second posting. Support refunded 23 accounts by hand last week.',
    '',
    'One event id should produce one credit, however many times it arrives. The fix belongs in payments-api, and ledger-core must still show one posting per event id.',
  ].join('\n'),
} as const;

export const STORY_QUESTION = {
  text: 'What should a repeated webhook return?',
  options: ['Return the original credit', 'Reject it with a 409', 'Return 200 and log a warning'],
  recommended: 'Return the original credit',
} as const;

export const STORY_PLANNER = {
  intro:
    'I read the webhook handler in payments-api and the posting writer in ledger-core. The handler applies the credit before it records the event id, so a late redelivery is credited again. One decision before I write the plan.',
  command: 'rg -n "applyWebhook|postEntry" payments-api/src ledger-core/src',
  output: 'payments-api/src/webhooks/applyWebhook.ts\nledger-core/src/postings/postEntry.ts',
  handoff:
    'Picked this up on Codex with the same issue and your answer. A repeated webhook returns the original credit, so I wrote the plan around that.',
  revision:
    'Added a test for two retries arriving at the same moment, as you asked. The plan is now v2.',
} as const;

export const STORY_PLAN = {
  title: 'Idempotent webhook credits',
  replayHeading: 'Tests',
  replayParagraph:
    'Add a replay test that sends the same webhook three times and checks that the account holds one credit.',
  concurrentParagraph:
    'Add a concurrent retries test that delivers the same event twice at the same moment and checks that the account holds one credit.',
  goal: 'A redelivered webhook must credit the account once. A repeated event id returns the original credit, and ledger-core keeps one posting per event id.',
  changes:
    'Record the processor event id in a processed_events table inside the credit transaction. When the id is already there, return the original credit instead of posting again.',
  verification:
    'Run the existing posting checks in ledger-core without changing its files, and confirm one posting per event id.',
  clusters: [
    { title: 'Record the event id inside the credit transaction', instructions: 'Add the guard.' },
    { title: 'Return the original credit for a repeated event id', instructions: 'Return it.' },
    { title: 'Cover repeated webhooks with tests', instructions: 'Add the tests.' },
  ],
} as const;

export const STORY_COMMENT = 'Test two retries arriving together.';

export const STORY_REVIEW = {
  prTitle: 'Return the original credit for a repeated webhook',
  comment:
    'Please add a regression test that restarts the worker between two deliveries of the same event id.',
  path: 'test/webhooks/redelivery.test.ts',
  line: 21,
  reviewer: 'nadia-p',
  summary:
    'redelivery.test.ts now restarts the worker between two deliveries of the same event id and expects one credit. The suite passes, and a reply is drafted for nadia-p.',
  narration: 'Adding a test that restarts the worker between two deliveries of the same event id.',
  reply:
    'Added a regression test that restarts the worker between two deliveries of the same event id. It expects one credit.',
  diff: [
    'diff --git a/test/webhooks/redelivery.test.ts b/test/webhooks/redelivery.test.ts',
    '--- a/test/webhooks/redelivery.test.ts',
    '+++ b/test/webhooks/redelivery.test.ts',
    "@@ -18,3 +18,14 @@ describe('redelivery', () => {",
    "   it('credits once for three deliveries', async () => {",
    '     expect(await creditsFor(account)).toBe(1);',
    '   });',
    '+',
    "+  it('credits once when the worker restarts between deliveries', async () => {",
    '+    await deliver(event);',
    '+    await restartWorker();',
    '+    await deliver(event);',
    '+    expect(await creditsFor(account)).toBe(1);',
    '+  });',
    ' });',
  ].join('\n'),
} as const;

export const STORY_RUN = {
  implementerTask: 'Guard the credit on the event id in payments-api.',
  implementerSummary:
    'A repeated event id returns the original credit. One credit is posted per event.',
  testerTask: 'Check the behavior against ledger-core without changing its files.',
  testerSummary:
    'ledger-core shows one posting per event id. The existing checks pass and nothing changed there.',
  lead: 'Plan v2 approved. A Codex implementer guards the credit in payments-api, and a tester checks the behavior against ledger-core without changing its files.',
  final:
    'Both agents finished. A repeated webhook returns the original credit, ledger-core keeps one posting per event id, and the checks pass. One branch in payments-api is ready to publish.',
} as const;
