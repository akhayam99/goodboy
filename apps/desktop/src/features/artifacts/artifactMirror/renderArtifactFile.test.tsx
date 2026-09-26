// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import type { ReportArtifact } from '@goodboy/types';
import { artifactDocumentCss, renderArtifactFile } from './renderArtifactFile';
import { documentTokens } from './documentTokens';

const report = {
  id: 'report-3f9a1c',
  sessionId: 'session-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown',
  sourceText: [
    '<<summary>>',
    'The drift comes from per line rounding.',
    '<</summary>>',
    '',
    '## Cause',
    '',
    'text <<warn>>',
    '',
    '## Fix',
    '',
    '<<risk>>',
    'Northwind batches settle late.',
    '<</risk>>',
    '',
    '## Evidence',
    '',
    '| id | note |',
    '| --- | --- |',
    '| s1 | payments-api |',
  ].join('\n'),
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 3,
  sourceTurnId: null,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T11:00:00.000Z',
} as unknown as ReportArtifact;

describe('renderArtifactFile', () => {
  const html = renderArtifactFile({ artifact: report });

  it('writes a standalone page that links its stylesheet', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<link rel="stylesheet" href="document.css">');
    expect(html).toContain('data-medium="file"');
    expect(html).toContain('Rounding drift in ledger-core postings');
    expect(html).toContain('data-tone="risk"');
  });

  it('carries no script, no style element, no inline style and no app image', () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/<img/i);
  });

  it('ships a stylesheet with the light tokens the sheet reads', () => {
    const css = artifactDocumentCss();
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toMatch(/--color-foreground: oklch\(/);
    expect(css).toContain('.print-sheet');
    expect(css).toContain(".print-sheet[data-medium='file']");
  });
});

describe('documentTokens', () => {
  it('lets the light palette win over the default theme and drops comments', () => {
    const styles = [
      '@theme {',
      '  --font-sans: a,',
      '    b;',
      '  /* --color-ghost: red; */',
      '  --color-foreground: white;',
      '}',
      "html[data-theme='light'] {",
      '  --color-foreground: black;',
      '}',
    ].join('\n');
    expect(documentTokens({ styles })).toBe(
      [':root {', '  --font-sans: a, b;', '  --color-foreground: black;', '}', ''].join('\n'),
    );
  });
});
