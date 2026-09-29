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
