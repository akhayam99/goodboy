import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { extractArtifactBlocks } from './artifacts/grammar';
import { parseArtifactEnvelope } from './artifacts/parseArtifactEnvelope';
import { parseChildClosing } from './auto/closing';
import { unwrapEdgeFence } from './code-fence';
import { normalizeDecisionText } from './context/decisions-ledger';
import { stripControlMarkers } from './context/marker-parsing';
import { parseToolPattern } from './permissions/matcher';
import { parseCliVersion } from './providers/cliVersion';
import { parseClaudeUsageText } from './providers/limits/parseClaudeUsageText';
import { extractJson } from './summarizer/extract-json';
import { parseIssueBrief } from './summarizer/issue-brief';

const RUN = 50_000;
const LEGACY_SECTION = '## Summary\n\nThe ledger-core retry work landed in two pull requests.\n\n';
const LEGACY_CONTENT = LEGACY_SECTION.repeat(1_500).trim();
const LEGACY_ENVELOPE = [
  '<<artifact v=1 kind=report>>',
  '{',
  '  "title": "Harborline retry report",',
  '  "format": "markdown",',
  `  "content": "${LEGACY_CONTENT}",`,
  '  "metadata": {"reportType": "change-summary"}',
  '}',
  '<</artifact>>',
].join('\n');
const DASHES = '-'.repeat(RUN);
const CLOSING_AGENT_ID = 'agent-scout-1';
const BUDGET_MS = 200;

type Case = {
  readonly name: string;
  readonly run: () => unknown;
  readonly budgetMs?: number;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'stripControlMarkers on repeated unrecognized opening tags',
    run: () => stripControlMarkers('<<ctx-widget '.repeat(8_000)),
  },
  {
    name: 'stripControlMarkers on repeated block opening tags without a close',
    run: () => stripControlMarkers('<<plan '.repeat(8_000)),
  },
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
  {
    name: 'parseArtifactEnvelope on a 100 KB legacy body with raw newlines',
    run: () => {
      expect(LEGACY_ENVELOPE.length).toBeGreaterThan(100_000);
      return parseArtifactEnvelope(LEGACY_ENVELOPE);
    },
    budgetMs: 2_000,
  },
  {
    name: 'parseChildClosing on a long run of dashes in a closing line',
    run: () => [
      parseChildClosing({ text: `<<step-done ${DASHES}>>`, childAgentId: CLOSING_AGENT_ID }),
      parseChildClosing({
        text: `<<step-done ${DASHES} id="${CLOSING_AGENT_ID}>>`,
        childAgentId: CLOSING_AGENT_ID,
      }),
      parseChildClosing({
        text: `<<step-done ${DASHES} id="${CLOSING_AGENT_ID}" ${DASHES}>>`,
        childAgentId: CLOSING_AGENT_ID,
      }),
    ],
    budgetMs: 500,
  },
  {
    name: 'extractJson on tabs after an open fence',
    run: () => extractJson({ raw: `\`\`\`${'\t'.repeat(100_000)}` }),
    budgetMs: 50,
  },
  {
    name: 'extractJson on tabs before trailing text',
    run: () => extractJson({ raw: `\`\`\`${'\t'.repeat(100_000)}x` }),
    budgetMs: 50,
  },
  {
    name: 'extractJson on a json tag and spaces before trailing text',
    run: () => extractJson({ raw: `\`\`\`json${' '.repeat(100_000)}x` }),
    budgetMs: 50,
  },
  {
    name: 'parseToolPattern matches a six-wildcard rule on a hostile command',
    run: () =>
      parseToolPattern({ pattern: 'Bash(*a*a*a*a*a*a*b)' }).matches({
        toolName: 'Bash',
        input: { command: 'a'.repeat(5_000) },
      }),
    budgetMs: 500,
  },
];

describe('pathological input stays linear', () => {
  it.each(CASES)('$name', ({ run, budgetMs = BUDGET_MS }) => {
    const started = performance.now();
    run();
    expect(performance.now() - started).toBeLessThan(budgetMs);
  });
});
