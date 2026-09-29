import { describe, expect, it } from 'vitest';
import { scanArtifactBlocks } from './grammar';
import { parseArtifactEnvelope } from './parseArtifactEnvelope';

const REPORT_MARKDOWN = [
  '## Summary',
  '',
  'The ledger-core retry work landed in two pull requests. The "idempotency key" guard now',
  'rejects replays, and notify-relay stops double sending.',
  '',
  '## Changes',
  '',
  '- `ledger-core/src/settle.ts`: added the guard',
  '- `notify-relay/src/queue.ts`: dedupe by key',
  '',
  '## Evidence',
  '',
  '| Source | Kind | Status |',
  '| --- | --- | --- |',
  '| settle batch | pull request | merged |',
  '',
  '## Missing evidence',
  '',
  'The payments-api logs were truncated after 2,000 lines.',
].join('\n');

const legacyEnvelope = (body: string, kind = 'report'): string =>
  [
    "I've gathered the evidence. Here is the report:",
    '',
    `<<artifact v=1 kind=${kind}>>`,
    body,
    '<</artifact>>',
    '',
    'Let me know if you want a shorter version.',
  ].join('\n');

const rawLegacyBody = (content: string): string =>
  [
    '{',
    '  "title": "Harborline retry report",',
    '  "format": "markdown",',
    `  "content": "${content}",`,
    '  "metadata": {"reportType": "change-summary"}',
    '}',
  ].join('\n');

const expectReport = (text: string) => {
  const result = parseArtifactEnvelope(text);
  expect(result.status).toBe('captured');
  if (result.status !== 'captured') {
    throw new Error(`not captured: ${JSON.stringify(result)}`);
  }
  expect(result.artifact.kind).toBe('report');
  return result.artifact;
};

const strictParses = (body: string): boolean => {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
};

describe('artifact capture on realistic model output', () => {
  it('captures a legacy body whose markdown content has raw newlines', () => {
    const body = rawLegacyBody(REPORT_MARKDOWN.replaceAll('"', '\\"'));
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.title).toBe('Harborline retry report');
    expect(artifact.sourceText).toBe(REPORT_MARKDOWN);
    expect(artifact.metadata).toEqual({ reportType: 'change-summary' });
  });

  it('captures a legacy body with raw newlines and unescaped double quotes', () => {
    const body = rawLegacyBody(REPORT_MARKDOWN);
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.sourceText).toContain('The "idempotency key" guard');
    expect(artifact.metadata).toEqual({ reportType: 'change-summary' });
  });

  it('captures a legacy body whose content holds a JSON snippet in a code fence', () => {
    const content = [
      '## Config change',
      '',
      '```json',
      '{"retries": 3, "backoff": "exponential"}',
      '```',
      '',
      'The value "exponential", as before, stays.',
    ].join('\n');
    const body = rawLegacyBody(content);
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.sourceText).toBe(content);
  });

  it('captures a legacy body with tabs and windows line endings', () => {
    const content = '## Steps\r\n\r\n1.\tRun the settle job\r\n2.\tCheck the Northwind dashboard';
    const body = rawLegacyBody(content).replaceAll('\n', '\r\n');
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.sourceText).toContain('1.\tRun the settle job');
  });

  it('captures a legacy body with markdown backslash escapes that are not JSON escapes', () => {
    const content = 'rows in the \\_pending\\_ table: 3 \\| 4, see \\*notes\\*\\nnext line';
    const body = rawLegacyBody(content);
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.sourceText).toBe(
      'rows in the \\_pending\\_ table: 3 \\| 4, see \\*notes\\*\nnext line',
    );
  });

  it('captures a body whose JSON delimiters are smart quotes', () => {
    const body =
      '{“title”: “Cascadia weekly”, “format”: “markdown”, “content”: “## Week\nAll green.”}';
    expect(strictParses(body)).toBe(false);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.title).toBe('Cascadia weekly');
    expect(artifact.sourceText).toBe('## Week\nAll green.');
  });

  it('captures a block wrapped in a json code fence', () => {
    const body = JSON.stringify({ title: 'Acme summary', format: 'markdown', content: '## Done' });
    const text = [
      'Here it is:',
      '```json',
      '<<artifact v=1 kind=report>>',
      body,
      '<</artifact>>',
      '```',
    ].join('\n');
    expect(expectReport(text).title).toBe('Acme summary');
  });

  it('captures a body followed by trailing prose inside the block', () => {
    const body = `${JSON.stringify({ title: 'Acme summary', content: '## Done' })}\n\nThat is the full report.`;
    expect(strictParses(body)).toBe(false);
    expect(expectReport(legacyEnvelope(body)).sourceText).toBe('## Done');
  });

  it('captures a very long legacy content with raw newlines', () => {
    const section = `${REPORT_MARKDOWN}\n\n`;
    const content = section.repeat(250).trim();
    const body = rawLegacyBody(content);
    expect(body.length).toBeGreaterThan(100_000);
    const artifact = expectReport(legacyEnvelope(body));
    expect(artifact.sourceText).toBe(content);
  });

  it('captures a legacy block that streamed in over many chunks', () => {
    const text = legacyEnvelope(rawLegacyBody(REPORT_MARKDOWN));
    const chunkSize = 37;
    let streamed = '';
    let state = null as ReturnType<typeof scanArtifactBlocks>['state'] | null;
    for (let index = 0; index < text.length; index += chunkSize) {
      streamed += text.slice(index, index + chunkSize);
      state = scanArtifactBlocks({ text: streamed, from: state }).state;
    }
    expect(scanArtifactBlocks({ text: streamed, from: state }).spans).toHaveLength(1);
    expect(expectReport(streamed).sourceText).toContain('## Missing evidence');
  });

  it('captures the header line protocol with a raw markdown body', () => {
    const header = JSON.stringify({
      title: 'Harborline retry report',
      format: 'markdown',
      metadata: { reportType: 'session-summary' },
    });
    const content = `${REPORT_MARKDOWN}\n\n\`\`\`ts\nconst key = "a\\\\b";\n\`\`\``;
    const artifact = expectReport(legacyEnvelope(`${header}\n${content}`));
    expect(artifact.sourceText).toBe(content);
    expect(artifact.metadata).toEqual({ reportType: 'session-summary' });
  });

  it('captures a pretty printed header followed by a raw body', () => {
    const header = ['{', '  "title": "Northwind review",', '  "format": "markdown"', '}'].join(
      '\n',
    );
    const artifact = expectReport(legacyEnvelope(`${header}\n\n${REPORT_MARKDOWN}`));
    expect(artifact.title).toBe('Northwind review');
    expect(artifact.sourceText).toBe(REPORT_MARKDOWN);
  });

  it('captures a raw body whose last code fence was never closed', () => {
    const header = JSON.stringify({ title: 'Acme notes', format: 'markdown' });
    const content = '## Output\n\n```\nsettled 3 batches';
    const artifact = expectReport(legacyEnvelope(`${header}\n${content}`));
    expect(artifact.sourceText).toBe(content);
  });

  it('captures a plan header with clusters followed by raw markdown', () => {
    const header = JSON.stringify({
      title: 'Backfill settled batches',
      format: 'markdown',
      metadata: { clusters: [{ title: 'add guard', instructions: 'edit settle.ts' }] },
    });
    const result = parseArtifactEnvelope(legacyEnvelope(`${header}\n## Goal\nno "dupes"`, 'plan'));
    expect(result.status).toBe('captured');
    if (result.status !== 'captured' || result.artifact.kind !== 'plan') return;
    expect(result.artifact.sourceText).toBe('## Goal\nno "dupes"');
    expect(result.artifact.metadata.clusters).toHaveLength(1);
  });

  it('captures a wireframe header followed by the raw document', () => {
    const header = JSON.stringify({ title: 'Home', format: 'json', metadata: { fidelity: 'low' } });
    const document = JSON.stringify(
      {
        version: 1,
        initialScreenId: 'home',
        theme: { name: 'generic' },
        screens: [
          {
            id: 'home',
            title: 'Home',
            viewport: 'desktop',
            root: {
              id: 'home-root',
              kind: 'navigation',
              variant: 'top',
              items: [{ id: 'nav-home', label: 'Home', isActive: true }],
            },
          },
        ],
      },
      null,
      2,
    );
    const result = parseArtifactEnvelope(legacyEnvelope(`${header}\n${document}`, 'wireframe'));
    expect(result.status).toBe('captured');
  });

  it('still rejects a body that is not JSON at all', () => {
    const result = parseArtifactEnvelope(legacyEnvelope('title: Acme\ncontent: nope'));
    expect(result).toMatchObject({ status: 'error', code: 'invalid_json' });
  });
});
