export type MockChatAnswer = {
  readonly key: string;
  readonly question: string;
  readonly match: RegExp;
  readonly text: string;
  readonly reads: ReadonlyArray<string>;
};

export const MOCK_CHAT_ANSWERS: ReadonlyArray<MockChatAnswer> = [
  {
    key: 'lunch',
    question: 'Lunch ideas near the office? Something for five people.',
    match: /lunch|eat|food|coffee|dinner|pizza/i,
    text: [
      '**Three picks within a ten minute walk: one quick, one sit down, one for the whole team.**',
      '',
      '- **Quick**: Tidewater Poke, 4 minutes away, ready in ten.',
      '- **Sit down**: Osteria Lanterna, 8 minutes, set lunch until 14:30.',
      '- **Group**: Harbor Hall market, 6 minutes, everyone picks their own stall.',
    ].join('\n'),
    reads: [],
  },
  {
    key: 'release',
    question: 'What do I check before tagging a payments-api release?',
    match: /release|tag/i,
    text: [
      '**Four checks, in this order, before you tag a payments-api release.**',
      '',
      '1. Migrations run clean on a copy of staging.',
      '2. The changelog has an entry per merged HAR ticket (payments-api/CHANGELOG.md).',
      '3. The webhook contract test passes against notify-relay.',
      '4. Mara Quint signs off on anything that touches refunds.',
    ].join('\n'),
    reads: ['payments-api/RELEASING.md', 'payments-api/CHANGELOG.md'],
  },
  {
    key: 'retry',
    question: 'Why does notify-relay retry twice? I see two emails for one failed send.',
    match: /retry|twice/i,
    text: [
      '**Two layers retry the same failure: the queue retries the job once, and the HTTP client inside the job retries once more.**',
      '',
      '- notify-relay/src/queue/worker.ts:52 sets `maxAttempts: 2` on the send job.',
      '- notify-relay/src/http/client.ts:19 wraps every call in `withRetry(1)`.',
      '',
      '1. **Drop the client retry.** The queue already backs off, one line to change.',
      '2. **Keep both, send once.** Pass an idempotency key so a second send is ignored.',
    ].join('\n'),
    reads: [
      'notify-relay/src/queue/worker.ts',
      'notify-relay/src/http/client.ts',
      'notify-relay/src/queue/config.ts',
    ],
  },
  {
    key: 'changes',
    question: 'What changed in payments-api this week',
    match: /change|this week|merged/i,
    text: [
      '**Nine changes merged in payments-api since Monday. Three touch checkout, none touch the public API.**',
      '',
      '| Day | Change | By |',
      '| --- | --- | --- |',
      '| Mon | Split the refund handler, HAR-198 | Mara Quint |',
      '| Tue | Consent copy v3, HAR-212 | Theo Varga |',
      '| Wed | IBAN check moved to the server, HAR-205 | Ines Okafor |',
      '| Thu | Retry budget for webhooks, HAR-219 | Theo Varga |',
    ].join('\n'),
    reads: [
      'payments-api/CHANGELOG.md',
      'payments-api/src/checkout/refund.ts',
      'payments-api/src/iban/validate.ts',
    ],
  },
  {
    key: 'rounding',
    question: 'Why do refunds round differently in ledger-core?',
    match: /round/i,
    text: [
      '**Refunds round half-even and charges round half-up, so a refund can land one cent off the charge.**',
      '',
      '- ledger-core/src/money/round.ts:24',
      '- ledger-core/src/refunds/book.ts:61',
    ].join('\n'),
    reads: ['ledger-core/src/money/round.ts', 'ledger-core/src/refunds/book.ts'],
  },
  {
    key: 'webhook',
    question: 'Can we rename the webhook table without downtime?',
    match: /webhook|rename/i,
    text: '**Yes, in two steps: add a view with the new name first, move the readers, then rename.**\n\n- payments-api/db/migrations/0142_webhooks.sql',
    reads: ['payments-api/db/migrations/0142_webhooks.sql', 'payments-api/src/webhooks/store.ts'],
  },
  {
    key: 'flaky',
    question: 'Why is the balance test in ledger-core flaky?',
    match: /flaky|balance/i,
    text: '**The ledger-core balance test depends on the wall clock and fails near midnight UTC.**\n\n- ledger-core/test/balance.test.ts:40',
    reads: ['ledger-core/test/balance.test.ts'],
  },
  {
    key: 'consent',
    question: 'Where is the consent step defined?',
    match: /consent/i,
    text: [
      '**It lives in payments-api: the questionnaire declares consent as step 4, in steps.ts at line 88.**',
      '',
      '| File | What it does |',
      '| --- | --- |',
      '| payments-api/src/questionnaire/steps.ts:88 | Declares the step, its copy and the required checkbox |',
      '| payments-api/src/questionnaire/ConsentStep.tsx:14 | Draws the checkbox, keeps Next off until ticked |',
      '| payments-api/src/api/consent.ts:31 | Saves the time and policy version with the order |',
    ].join('\n'),
    reads: [
      'payments-api/src/questionnaire/steps.ts',
      'payments-api/src/questionnaire/ConsentStep.tsx',
      'payments-api/src/api/consent.ts',
      'payments-api/src/config/policy.ts',
    ],
  },
];

const GENERIC_ANSWER: MockChatAnswer = {
  key: 'generic',
  question: '',
  match: /.^/,
  text: [
    '**Two places in Harborline match what you asked. The first one is where the behavior lives.**',
    '',
    '- payments-api/src/checkout/pay.ts:77 is the entry point.',
    '- ledger-core/src/entries/post.ts:18 is where it ends up.',
  ].join('\n'),
  reads: ['payments-api/src/checkout/pay.ts', 'ledger-core/src/entries/post.ts'],
};

type Params = {
  readonly question: string;
};

export const pickMockChatAnswer = ({ question }: Params): MockChatAnswer =>
  MOCK_CHAT_ANSWERS.find((answer) => answer.match.test(question)) ?? GENERIC_ANSWER;
