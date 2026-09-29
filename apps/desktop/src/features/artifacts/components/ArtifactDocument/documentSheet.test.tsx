// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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

const sheetStyle = document.createElement('style');

beforeAll(() => {
  document.head.append(sheetStyle);
  sheetStyle.textContent = SHEET_CSS;
});

afterAll(() => {
  sheetStyle.remove();
});

afterEach(cleanup);

const renderSheet = (): HTMLElement => {
  const { container } = render(
    <div className="print-sheet" data-medium="screen">
      <ArtifactDocument artifact={report} medium="screen" workspaceName="harborline" />
    </div>,
  );
  return container;
};

type DeclaredParams = {
  readonly selector: string;
  readonly property: string;
  readonly media?: string;
};

const declared = ({ selector, property, media }: DeclaredParams): string => {
  const rules = Array.from(sheetStyle.sheet?.cssRules ?? []);
  const scoped =
    media === undefined
      ? rules
      : rules.flatMap((rule) => {
          const group = rule as unknown as {
            conditionText?: string;
            cssRules?: ArrayLike<CSSRule>;
          };
          return group.conditionText === media ? Array.from(group.cssRules ?? []) : [];
        });
  const match = scoped.find((rule) => (rule as CSSStyleRule).selectorText === selector);
  return (match as CSSStyleRule | undefined)?.style.getPropertyValue(property) ?? '';
};

describe('artifactDocument.css', () => {
  it('reads Inter from the global face, never its own face or a runtime style tag', () => {
    const { container } = render(
      <div className="print-sheet" data-medium="screen">
        <ArtifactDocument artifact={report} medium="screen" workspaceName="harborline" />
      </div>,
    );
    expect(container.querySelectorAll('style')).toHaveLength(0);
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(SHEET_CSS).not.toContain('@font-face');
    expect(SHEET_CSS).toContain("font-family: 'Inter', var(--font-sans);");
  });

  it('numbers every h2 section with a css counter, never a hardcoded digit', () => {
    const headings = Array.from(renderSheet().querySelectorAll('.print-body h2'));

    expect(headings).toHaveLength(3);
    for (const heading of headings) {
      expect(getComputedStyle(heading).counterIncrement).toBe('gb-section');
      expect(heading.textContent).not.toMatch(/^\d/);
    }
    expect(
      getComputedStyle(renderSheet().querySelector('.print-document') as Element).counterReset,
    ).toBe('gb-section');
  });

  it('repeats the table header and bands rows instead of drawing horizontal rules', () => {
    const container = renderSheet();
    const head = container.querySelector('.print-body thead') as Element;
    const rows = Array.from(container.querySelectorAll('.print-body tbody tr'));
    const cell = container.querySelector('.print-body tbody td') as Element;

    expect(head.tagName).toBe('THEAD');
    expect(SHEET_CSS).toMatch(/\.print-body thead \{[^}]*display: table-header-group;/);
    expect(rows).toHaveLength(2);
    const banded = '.print-sheet .print-body tbody tr:nth-child(even)';
    expect(rows[1]?.matches(banded)).toBe(true);
    expect(rows[0]?.matches(banded)).toBe(false);
    expect(declared({ selector: banded, property: 'background' })).toBe('var(--print-wash)');
    expect(getComputedStyle(cell).borderBottomWidth).toBe('0px');
  });

  it('carries a page-number and title footer for the printed paper', () => {
    const title = renderSheet().querySelector('.print-footer-title') as Element;

    expect(title.textContent).toContain(report.title);
    expect(
      declared({ selector: '.print-footer-title', property: 'string-set', media: 'print' }),
    ).toBe('gb-doc-title content()');
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
