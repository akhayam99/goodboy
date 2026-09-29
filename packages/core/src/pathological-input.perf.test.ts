import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { extractArtifactBlocks } from './artifacts/grammar';
import { unwrapEdgeFence } from './code-fence';
import { normalizeDecisionText } from './context/decisions-ledger';
import { parseCliVersion } from './providers/cliVersion';
import { parseClaudeUsageText } from './providers/limits/parseClaudeUsageText';
import { parseIssueBrief } from './summarizer/issue-brief';

const RUN = 50_000;
const BUDGET_MS = 200;

type Case = {
  readonly name: string;
  readonly run: () => unknown;
  readonly budgetMs?: number;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'unwrapEdgeFence on tabs after an opening fence',
    run: () => unwrapEdgeFence({ text: `\`\`\`${'\t'.repeat(RUN)}x` }),
  },
  {
    name: 'normalizeDecisionText on trailing punctuation',
    run: () => normalizeDecisionText({ text: `decision${'!'.repeat(RUN)}` }),
  },
  {
    name: 'parseCliVersion on dotted digits',
    run: () => parseCliVersion({ raw: `${'1.'.repeat(RUN)}x` }),
  },
  {
    name: 'parseClaudeUsageText on a whitespace reset',
    run: () =>
      parseClaudeUsageText({
        text: `Current week: 0% used - resets\t${'\t\t'.repeat(RUN)}`,
        observedAt: '2026-09-28T09:00:00.000Z' as IsoDateTime,
        nowMs: Date.parse('2026-09-28T09:00:00Z'),
      }),
  },
  {
    name: 'parseIssueBrief on whitespace inside a fence',
    run: () => parseIssueBrief({ text: `\`\`\`${' '.repeat(RUN)}x` }),
  },
  {
    name: 'extractArtifactBlocks on a pathological marker line',
    run: () => extractArtifactBlocks(`<<artifact${'\t-="'.repeat(64)}`),
    budgetMs: 1_000,
  },
];

describe('pathological input stays linear', () => {
  it.each(CASES)('$name', ({ run, budgetMs = BUDGET_MS }) => {
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(budgetMs);
  });
});
