export const BRAND_WORKSPACE_NAME = 'Harborline';

export const BRAND_PROJECTS = {
  payments: { name: 'payments-api', rootPath: '~/code/harborline/payments-api' },
  ledger: { name: 'ledger-core', rootPath: '~/code/harborline/ledger-core' },
  relay: { name: 'notify-relay', rootPath: '~/code/harborline/notify-relay' },
} as const;

export const BRAND_PEOPLE = {
  owner: { name: 'Dana R.', handle: 'dana-r' },
  reviewer: { name: 'Kenji W.', handle: 'kenji-w' },
  reporter: { name: 'Marta L.', handle: 'marta-l' },
  oncall: { name: 'Omar T.', handle: 'omar-t' },
} as const;

export const BRAND_SESSION = {
  title: 'Stop retried webhooks posting a second credit',
  goal: 'Stop retried webhooks posting a second credit. When the processor redelivers an event, payments-api must credit the account once, and ledger-core must still show one posting per event id.',
  issue: 'HBL-412',
  issueTitle: 'Retried webhooks post a second credit',
  sentry: 'DuplicateCreditError in applyWebhook',
  branch: 'hl/fix-duplicate-credit',
  paymentsPr: 318,
  cost: 3.47,
} as const;

export const BRAND_DECISIONS = [
  { number: 1, text: 'Dedupe in the webhook handler', state: 'replaced', by: 'Plan', turn: 1 },
  {
    number: 2,
    text: 'Keep the processor event id on every credit row',
    state: 'active',
    by: 'Plan',
    turn: 1,
  },
  {
    number: 3,
    text: 'Dedupe on the event id inside the transaction',
    state: 'active',
    by: 'Plan',
    turn: 2,
    replaces: 1,
  },
] as const;

export const BRAND_OTHER_SESSIONS = [
  {
    title: 'Reconcile the settlement export against the ledger snapshot',
    stage: 'in review',
    project: 'ledger-core',
    pr: 90,
  },
  { title: 'Per-tenant limits on the public API', stage: 'building', project: 'payments-api' },
  { title: 'Retire the legacy export cron job', stage: 'done', project: 'ledger-core' },
  {
    title: 'Warn merchants before a payout hold',
    stage: 'needs you',
    project: 'notify-relay',
    pr: 61,
  },
  {
    title: 'Nightly reconciliation before the Monday close',
    stage: 'running',
    project: 'ledger-core',
  },
] as const;

export const BRAND_MODELS = {
  scout: { provider: 'anthropic', model: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  plan: { provider: 'anthropic', model: 'claude-opus-5-5', label: 'Opus 5.5', effort: 'high' },
  implement: { provider: 'codex', model: 'gpt-5.6-sol', label: 'GPT 5.6 Sol' },
} as const;

export const BRAND_TODAY_USD = 9.62;

export const BRAND_LIMITS = {
  claude: { fiveHour: 1, weekly: 0.84, backAt: '2026-09-27T12:20:00.000Z' },
  codex: { fiveHour: 0.41, weekly: 0.58 },
  resetExpiresAt: '2026-10-03T21:59:00.000Z',
} as const;
