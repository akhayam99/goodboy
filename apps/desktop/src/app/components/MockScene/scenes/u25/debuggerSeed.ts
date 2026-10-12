const ESC = String.fromCharCode(0x1b);

type PrefixParams = {
  readonly step: string;
  readonly second: number;
};

const prefix = ({ step, second }: PrefixParams) =>
  `payments-api / test\t${step}\t2026-10-10T09:30:0${second}.7123664Z `;

export const DEBUGGER_OPTIONS_TEXT = [
  '## Finding',
  'The retry path applies the credit again when the invoice was already credited.',
  'The ledger-core unit suite fails on the second call.',
  '',
  '## Proposed fix',
  '### Option A: Guard in the ledger',
  'Skip applyCredit in src/ledger.ts when the invoice already has a credit, and add a retry test in src/ledger.test.ts.',
  '',
  '```diff',
  '--- a/src/ledger.ts',
  '+++ b/src/ledger.ts',
  '@@ -1,1 +1,2 @@',
  '+if (hasCredit(invoice)) return;',
  ' applyCredit(invoice);',
  '```',
  '### Option B: Dedupe in the retry queue',
  'Drop repeated invoice ids in src/retryQueue.ts before they reach the ledger. The ledger stays unchanged.',
  '### Option C: Make credits idempotent by key',
  'Add an idempotency key to every credit in src/credits.ts. Larger change, touches notify-relay callers.',
  'Recommended: A',
  'It is the smallest change and the guard also protects every other caller.',
].join('\n');

export const DEBUGGER_RAW_LOG = [
  `${prefix({ step: 'UNKNOWN STEP', second: 0 })}${ESC}[36;1mpnpm test${ESC}[0m`,
  `${prefix({ step: 'Run tests', second: 1 })}${ESC}[32m PASS ${ESC}[0m src/credits.test.ts`,
  `${prefix({ step: 'Run tests', second: 2 })}${ESC}[31m FAIL ${ESC}[0m src/ledger.test.ts`,
  `${prefix({ step: 'Run tests', second: 3 })}Expected credits: 1`,
  `${prefix({ step: 'Run tests', second: 4 })}Received credits: 2`,
].join('\n');
