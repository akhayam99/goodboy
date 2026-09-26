// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReportArtifact, SessionId } from '@goodboy/types';
import { ArtifactDocument } from './index';

const SHEET_PATH = 'src/features/artifacts/components/ArtifactDocument/artifactDocument.css';

const SHEET_CSS = readFileSync(resolve(process.cwd(), SHEET_PATH), 'utf8');

const report = {
  id: 'report-1',
  sessionId: 'session-1' as SessionId,
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report' as const,
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core postings',
  sourceFormat: 'markdown' as const,
  sourceText: [
    '<<summary>>',
    'the drift comes from per line rounding.',
    '<</summary>>',
    '',
    '## What shipped',
    '',
    'one rounding per batch.',
    '',
    '| id | note |',
    '| --- | --- |',
    '| s1 | payments-api |',
    '| s2 | ledger-core |',
    '',
    '## Checks',
    '',
    'text',
    '',
    '## Risk',
    '',
    'text',
  ].join('\n'),
  metadata: { reportType: 'session-summary' as const },
  status: 'active' as const,
  revision: 2,
  sourceTurnId: null,
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
} as unknown as ReportArtifact;

afterEach(cleanup);

describe('artifactDocument.css', () => {
  it('embeds Inter as a variable font, never a runtime style tag', () => {
    const { container } = render(
      <div className="print-sheet" data-medium="screen">
        <ArtifactDocument artifact={report} medium="screen" workspaceName="harborline" />
      </div>,
    );
    expect(container.querySelectorAll('style')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(SHEET_CSS).toMatch(/@font-face \{[^}]*font-family: 'Inter';/);
    expect(SHEET_CSS).toMatch(/InterVariable-latin\.woff2/);
    expect(SHEET_CSS).toContain("format('woff2-variations')");
  });

  it('numbers every h2 section with a css counter, never a hardcoded digit', () => {
    expect(SHEET_CSS).toContain('counter-reset: gb-section;');
    expect(SHEET_CSS).toMatch(/\.print-body h2 \{[^}]*counter-increment: gb-section;/);
    expect(SHEET_CSS).toMatch(
      /\.print-body h2::before \{[^}]*content: counter\(gb-section, decimal-leading-zero\);/,
    );
  });

  it('repeats the table header and bands rows instead of drawing horizontal rules', () => {
    expect(SHEET_CSS).toContain('table-header-group');
    expect(SHEET_CSS).toMatch(/tbody tr:nth-child\(even\) \{[^}]*background: var\(--print-wash\);/);
    expect(SHEET_CSS).not.toMatch(/\.print-body td \{[^}]*border-bottom/);
  });

  it('carries a page-number and title footer for the printed paper', () => {
    expect(SHEET_CSS).toContain('string-set: gb-doc-title content();');
    expect(SHEET_CSS).toMatch(/@bottom-left \{[^}]*content: string\(gb-doc-title\);/);
    expect(SHEET_CSS).toMatch(
      /@bottom-right \{[^}]*content: 'Page ' counter\(page\) ' of ' counter\(pages\);/,
    );
  });

  it('pins the A4 paper and lets the page margin alone set the text block', () => {
    expect(SHEET_CSS).toMatch(/@page \{[^@]*size: A4;/);
    expect(SHEET_CSS).toContain('size: A4 landscape');
    expect(SHEET_CSS).toMatch(/@media print \{\s*\.print-sheet \{[^}]*max-width: none;/);
  });

  it('scales screen and file the same, and shrinks for paper under one set of tokens', () => {
    expect(SHEET_CSS).toMatch(/--print-title-size: 32px;/);
    expect(SHEET_CSS).toMatch(/--print-body-size: 15px;/);
    expect(SHEET_CSS).toMatch(/--print-lead-size: 18px;/);
    expect(SHEET_CSS).toMatch(/--print-metric-size: 26px;/);
    expect(SHEET_CSS).toMatch(/@media print \{\s*\.print-sheet \{[^}]*--print-title-size: 22pt;/);
    expect(SHEET_CSS).toMatch(/--print-body-size: 10pt;/);
    expect(SHEET_CSS).toMatch(/font-variant-numeric: tabular-nums;/);
  });

  it('takes every colour from a token, so the sheet follows the theme', () => {
    expect(SHEET_CSS).toMatch(/--print-ink: var\(--color-foreground\);/);
    expect(SHEET_CSS).toMatch(/--print-accent: var\(--color-primary\);/);
    expect(SHEET_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('styles the compare and bars kit blocks only inside the document sheet', () => {
    expect(SHEET_CSS).toMatch(/\[data-block='compare'\] \{[^}]*display: grid;/);
    expect(SHEET_CSS).toMatch(/\[data-block='bar-fill'\] \{[^}]*fill: var\(--print-accent\);/);
    expect(SHEET_CSS).toMatch(/\[data-block='bar-track'\] \{[^}]*fill: var\(--print-wash\);/);
  });

  it('renders a facts grid two columns wide once there are enough entries', () => {
    expect(SHEET_CSS).toMatch(
      /\[data-block='facts'\]:has\(> dt:nth-child\(9\)\) \{[^}]*columns: 2;/,
    );
  });
});
