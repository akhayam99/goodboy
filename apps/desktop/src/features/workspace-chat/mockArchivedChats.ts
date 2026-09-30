const DAY_MS = 24 * 60 * 60 * 1000;

export type MockArchivedChat = {
  readonly key: string;
  readonly title: string;
  readonly ageMs: number;
  readonly archivedAgoMs: number;
  readonly question: string;
  readonly answer: string;
};

export const MOCK_ARCHIVED_CHATS: ReadonlyArray<MockArchivedChat> = [
  {
    key: 'invoice',
    title: 'Northwind invoice export format',
    ageMs: 12 * DAY_MS,
    archivedAgoMs: 3 * DAY_MS,
    question: 'How does the Northwind invoice export lay out its rows?',
    answer:
      '**One row per line item, with tax in its own column.** The header row is fixed, and amounts are written in minor units.',
  },
  {
    key: 'signing',
    title: 'Acme webhook signing',
    ageMs: 20 * DAY_MS,
    archivedAgoMs: 5 * DAY_MS,
    question: 'How are Acme webhooks signed?',
    answer:
      '**Signatures use HMAC-SHA256 over the raw body.** The header carries the timestamp and the signature, and requests older than five minutes are rejected.',
  },
  {
    key: 'import',
    title: 'Cascadia import mapping',
    ageMs: 30 * DAY_MS,
    archivedAgoMs: 9 * DAY_MS,
    question: 'How does the Cascadia import map its columns?',
    answer:
      '**Columns map by header name first, then by position when a header is missing.** Unmapped columns are kept in a notes field.',
  },
  {
    key: 'seed',
    title: 'Sandbox seed data',
    ageMs: 45 * DAY_MS,
    archivedAgoMs: 14 * DAY_MS,
    question: 'What does the sandbox seed script create?',
    answer:
      '**Three customers and a handful of orders.** Run it after a reset and the sandbox is ready for the storefront-web demo.',
  },
];
