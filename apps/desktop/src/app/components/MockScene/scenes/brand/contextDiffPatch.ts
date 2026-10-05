type Hunk = Readonly<{
  oldStart: number;
  newStart: number;
  context: string;
  lines: ReadonlyArray<string>;
}>;

type FilePatch = Readonly<{
  path: string;
  index: string;
  hunks: ReadonlyArray<Hunk>;
}>;

const countOf = (lines: ReadonlyArray<string>, skip: '+' | '-'): number =>
  lines.filter((line) => !line.startsWith(skip)).length;

const hunkText = ({ oldStart, newStart, context, lines }: Hunk): string =>
  [
    `@@ -${oldStart},${countOf(lines, '+')} +${newStart},${countOf(lines, '-')} @@${context === '' ? '' : ` ${context}`}`,
    ...lines,
  ].join('\n');

const fileText = ({ path, index, hunks }: FilePatch): string =>
  [
    `diff --git a/${path} b/${path}`,
    `index ${index} 100644`,
    `--- a/${path}`,
    `+++ b/${path}`,
    ...hunks.map(hunkText),
  ].join('\n');

export const APPLY_WEBHOOK_PATH = 'src/webhooks/applyWebhook.ts';
export const POST_CREDIT_PATH = 'src/ledger/postCredit.ts';
const WEBHOOK_TEST_PATH = 'test/applyWebhook.test.ts';

const APPLY_WEBHOOK: FilePatch = {
  path: APPLY_WEBHOOK_PATH,
  index: '3c1f9a2..8e4b7d0',
  hunks: [
    {
      oldStart: 1,
      newStart: 1,
      context: '',
      lines: [
        " import type { ProcessorEvent } from '../processor/types';",
        " import { db } from '../db';",
        " import { postCredit } from '../ledger/postCredit';",
        "-import { seenEvents } from './seenEvents';",
        "+import { isUniqueViolation } from '../db/errors';",
        ' ',
        ' export type WebhookResult = { status: 200 | 202; credited: boolean };',
        ' ',
        ' export const applyWebhook = async (event: ProcessorEvent): Promise<WebhookResult> => {',
        "   if (event.type !== 'payment.settled') {",
        '     return { status: 202, credited: false };',
        '   }',
        '-  if (await seenEvents.has(event.id)) {',
        '-    return { status: 200, credited: false };',
        '-  }',
        '-  await postCredit({',
        '-    accountId: event.data.accountId,',
        '-    amountCents: event.data.amountCents,',
        '-  });',
        '-  await seenEvents.add(event.id);',
        '-  return { status: 200, credited: true };',
        '+  try {',
        '+    await db.transaction(async (tx) => {',
        "+      await tx.insert('processed_events', {",
        '+        accountId: event.data.accountId,',
        '+        eventId: event.id,',
        '+      });',
        '+      await postCredit(tx, {',
        '+        accountId: event.data.accountId,',
        '+        amountCents: event.data.amountCents,',
        '+        eventId: event.id,',
        '+      });',
        '+    });',
        '+    return { status: 200, credited: true };',
        '+  } catch (error) {',
        "+    if (isUniqueViolation(error, 'processed_events_account_event')) {",
        '+      return { status: 200, credited: false };',
        '+    }',
        '+    throw error;',
        '+  }',
        ' };',
      ],
    },
  ],
};

export const APPLY_WEBHOOK_NOTE_LINE = 26;

const POST_CREDIT: FilePatch = {
  path: POST_CREDIT_PATH,
  index: '51d0c3e..a07f2b9',
  hunks: [
    {
      oldStart: 1,
      newStart: 1,
      context: '',
      lines: [
        "-import type { Db } from '../db';",
        "+import type { Tx } from '../db';",
        " import { ledger } from './client';",
        ' ',
        ' export type CreditInput = {',
        '   accountId: string;',
        '   amountCents: number;',
        '+  eventId: string;',
        ' };',
        ' ',
        '-export const postCredit = async (input: CreditInput): Promise<void> => {',
        '+export const postCredit = async (tx: Tx, input: CreditInput): Promise<void> => {',
        "+  await tx.insert('credits', {",
        '+    accountId: input.accountId,',
        '+    amountCents: input.amountCents,',
        '+    eventId: input.eventId,',
        '+  });',
        '   await ledger.post({',
        '     account: input.accountId,',
        '     amount: input.amountCents,',
        "     kind: 'credit',",
        '+    idempotencyKey: input.eventId,',
        '   });',
        ' };',
      ],
    },
  ],
};

const WEBHOOK_TEST: FilePatch = {
  path: WEBHOOK_TEST_PATH,
  index: '0b8e6f4..d3c9a51',
  hunks: [
    {
      oldStart: 40,
      newStart: 40,
      context: "describe('applyWebhook', () => {",
      lines: [
        '     expect(result).toEqual({ status: 202, credited: false });',
        '   });',
        ' ',
        "+  it('credits a redelivered event once', async () => {",
        "+    const event = settledEvent({ id: 'evt_4Q2x', amountCents: 12_500 });",
        '+',
        '+    const results = await Promise.all([',
        '+      applyWebhook(event),',
        '+      applyWebhook(event),',
        '+      applyWebhook(event),',
        '+    ]);',
        '+',
        '+    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);',
        "+    expect(await creditsFor('acct_7781')).toHaveLength(1);",
        '+  });',
        '+',
        "+  it('keeps the event id on the credit row', async () => {",
        "+    await applyWebhook(settledEvent({ id: 'evt_4Q3a', amountCents: 900 }));",
        "+    expect(await creditsFor('acct_7781')).toMatchObject([{ eventId: 'evt_4Q3a' }]);",
        '+  });',
        '+',
        "   it('ignores events it does not handle', async () => {",
        '     const result = await applyWebhook(refundEvent());',
        '     expect(result.status).toBe(202);',
      ],
    },
  ],
};

export const CTX_PATCH = `${[APPLY_WEBHOOK, POST_CREDIT, WEBHOOK_TEST].map(fileText).join('\n')}\n`;

export const RENAMED_PATH = 'src/ledger/ledgerClient.ts';
export const RENAMED_FROM = 'src/ledger/client.ts';
export const DELETED_PATH = 'src/webhooks/seenEvents.ts';

const RENAMED_HUNK: Hunk = {
  oldStart: 1,
  newStart: 1,
  context: '',
  lines: [
    " import { createClient } from '../processor/client';",
    ' ',
    "-export const ledger = createClient({ service: 'ledger' });",
    '+export const ledger = createClient({',
    "+  service: 'ledger',",
    '+  retries: 3,',
    '+});',
    ' ',
    ' export type LedgerPost = {',
    '   account: string;',
    '   amount: number;',
    "   kind: 'credit' | 'debit';",
    '+  idempotencyKey?: string;',
    ' };',
  ],
};

const RENAMED_TEXT = [
  `diff --git a/${RENAMED_FROM} b/${RENAMED_PATH}`,
  'similarity index 88%',
  `rename from ${RENAMED_FROM}`,
  `rename to ${RENAMED_PATH}`,
  'index 7a2e4c1..c90d3f5 100644',
  `--- a/${RENAMED_FROM}`,
  `+++ b/${RENAMED_PATH}`,
  hunkText(RENAMED_HUNK),
].join('\n');

const DELETED_LINES: ReadonlyArray<string> = [
  "-import { db } from '../db';",
  '-',
  '-export const seenEvents = {',
  '-  has: async (id: string): Promise<boolean> => {',
  "-    return (await db.get('seen_events', id)) !== null;",
  '-  },',
  '-  add: async (id: string): Promise<void> => {',
  "-    await db.insert('seen_events', { id });",
  '-  },',
  '-};',
];

const DELETED_TEXT = [
  `diff --git a/${DELETED_PATH} b/${DELETED_PATH}`,
  'deleted file mode 100644',
  'index 9d41b07..0000000',
  `--- a/${DELETED_PATH}`,
  '+++ /dev/null',
  `@@ -1,${DELETED_LINES.length} +0,0 @@`,
  ...DELETED_LINES,
].join('\n');

export const LOCKFILE_PATH = 'pnpm-lock.yaml';

const LOCKFILE: FilePatch = {
  path: LOCKFILE_PATH,
  index: 'e1b40a7..2f8c6d3',
  hunks: [
    {
      oldStart: 212,
      newStart: 212,
      context: 'packages:',
      lines: [
        '   /pg@8.11.3:',
        '-    resolution: {integrity: sha512-WQd0Qk5T1Yv3hZq0b6VtLm1aN9r2uK8jZc4oXe7sPfRw1Hg5nJ6yBvKiEw3dCaMxUq0tTlFo2zSrG8hYpVbD1A==}',
        '+    resolution: {integrity: sha512-bL3nR8vE5qXw0dYtJ4hZk7uPc2mFa9sGoT1eCiNx6yWrKj8VzQ0HbDlA3tUMgSf5pOEv2xYn7ZkRq1cJh4wB9g==}',
        '     engines: {node: ">= 8.0.0"}',
      ],
    },
  ],
};

export const BRANCH_FILES_PATCH = `${[APPLY_WEBHOOK, POST_CREDIT, WEBHOOK_TEST]
  .map(fileText)
  .concat(RENAMED_TEXT, DELETED_TEXT, fileText(LOCKFILE))
  .join('\n')}\n`;
