// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ArtifactId, SessionId } from '@goodboy/types';

const { listSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(async (_sessionId: string) => [] as ReadonlyArray<Record<string, unknown>>),
}));

vi.mock('../../../artifacts/artifacts', () => ({
  listArtifactsForSession: (sessionId: string) => listSpy(sessionId),
}));

import { ArtifactPrintView } from './index';

const SHEET_PATH = 'src/features/reports/components/ArtifactPrintView/printSheet.css';

const SHEET_CSS = readFileSync(resolve(process.cwd(), SHEET_PATH), 'utf8');

const APP_CSS = '.chip-background { background: rgb(210, 212, 216); }';

const request = {
  sessionId: 'session-1' as SessionId,
  artifactId: 'report-1' as ArtifactId,
};

const report = {
  id: 'report-1',
  sessionId: 'session-1',
  agentId: 'agent-1',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: [
    '## What shipped',
    '',
    'the pane calls `listArtifactsForSession` once.',
    '',
    '## Checks',
    '',
    'text',
    '',
    '## Risk',
    '',
    'text',
  ].join('\n'),
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: '2026-09-15T10:00:00',
  updatedAt: '2026-09-15T10:00:00',
};

const reportWithList = {
  ...report,
  sourceText: [
    '## What shipped',
    '',
    'the pane calls `listArtifactsForSession` once.',
    '',
    '- the first item of the list',
    '- the second item of the list',
    '',
    '## Checks',
    '',
    'text',
    '',
    '## Risk',
    '',
    'text',
  ].join('\n'),
};

const reportWithCallout = {
  ...report,
  sourceText: [
    '## What shipped',
    '',
    '<<question>>who signs the release<</question>>',
    '',
    '## Checks',
    '',
    'text',
    '',
    '## Risk',
    '',
    'text',
  ].join('\n'),
};

const wideWireframe = {
  ...report,
  kind: 'wireframe',
  title: 'Harborline console',
  sourceFormat: 'json',
  sourceText: JSON.stringify({
    version: 1,
    initialScreenId: 'console',
    theme: { name: 'harborline', font: 'sans', radius: 'md' },
    screens: [
      {
        id: 'console',
        title: 'Console',
        viewport: 'desktop',
        root: {
          id: 'console-root',
          kind: 'stack',
          direction: 'column',
          children: [{ id: 'console-heading', kind: 'text', text: 'Ledger', variant: 'title' }],
        },
      },
    ],
    transitions: [],
  }),
  metadata: { fidelity: 'low', designProfile: {} },
};

const adoptSheet = ({ css }: { readonly css: string }): void => {
  const sheet = document.createElement('style');
  sheet.setAttribute('data-testid', 'bundled-stylesheet');
  sheet.textContent = css;
  document.head.append(sheet);
};

type RenderParams = Readonly<{
  artifact: Record<string, unknown>;
}>;

const renderArtifact = async ({ artifact }: RenderParams) => {
  listSpy.mockResolvedValueOnce([artifact]);
  const rendered = render(<ArtifactPrintView request={request} />);
  await waitFor(() => {
    expect(screen.getByRole('navigation', { name: 'Contents' })).toBeDefined();
  });
  return rendered;
};

const renderSheet = async () => renderArtifact({ artifact: report });

const styleOf = ({ selector }: { readonly selector: string }): CSSStyleDeclaration => {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`the print sheet has no ${selector}`);
  }
  return globalThis.getComputedStyle(element);
};

const A4_WIDTH = '793.401px';
const A4_HEIGHT = '1122.0957px';

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('[data-testid="bundled-stylesheet"]').forEach((sheet) => {
    sheet.remove();
  });
});

describe('print sheet styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
  });

  it('dresses the rendered markup from the stylesheet the app bundles', async () => {
    adoptSheet({ css: APP_CSS });
    adoptSheet({ css: SHEET_CSS });
    await renderSheet();

    expect(styleOf({ selector: '.print-sheet' }).maxWidth).toBe(A4_WIDTH);
    expect(styleOf({ selector: '.print-sheet' }).minHeight).toBe(A4_HEIGHT);
    expect(styleOf({ selector: '.print-eyebrow' }).display).toBe('flex');
    expect(styleOf({ selector: '.print-meta' }).display).toBe('flex');
    expect(styleOf({ selector: '.print-title' }).fontWeight).toBe('600');
    expect(styleOf({ selector: '.print-contents-list' }).listStyle).toBe('none');
    expect(styleOf({ selector: '.print-contents' }).display).toBe('flex');
  });

  it('beats the app chip background on inline code, so a report prints flat', async () => {
    adoptSheet({ css: APP_CSS });
    adoptSheet({ css: SHEET_CSS });
    await renderSheet();

    const code = document.querySelector('.print-body code');
    if (code === null) {
      throw new Error('the print body has no inline code');
    }
    code.classList.add('chip-background');
    expect(globalThis.getComputedStyle(code).backgroundColor).toBe('none');
  });

  it('leaves the same markup bare when that stylesheet never arrives', async () => {
    adoptSheet({ css: APP_CSS });
    await renderSheet();

    expect(styleOf({ selector: '.print-sheet' }).maxWidth).not.toBe(A4_WIDTH);
    expect(styleOf({ selector: '.print-meta' }).display).not.toBe('flex');
    expect(styleOf({ selector: '.print-contents-list' }).listStyle).not.toBe('none');
    expect(styleOf({ selector: '.print-contents' }).display).not.toBe('flex');
  });

  it('widens the sheet for a landscape wireframe from the same stylesheet', async () => {
    adoptSheet({ css: SHEET_CSS });
    listSpy.mockResolvedValueOnce([wideWireframe]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByTestId('print-wireframe-sheet')).toBeDefined();
    });

    expect(screen.getByTestId('artifact-print-view').getAttribute('data-page')).toBe('landscape');
    expect(styleOf({ selector: '.print-sheet' }).maxWidth).toBe(A4_HEIGHT);
  });

  it('carries no style element of its own, which a stylesheet nonce would strip', async () => {
    const { container } = await renderSheet();

    expect(container.querySelectorAll('style')).toHaveLength(0);
    expect(document.querySelectorAll('style')).toHaveLength(0);
  });

  it('gives a long table a repeating header and no blanket avoid on a block', () => {
    expect(SHEET_CSS).toContain('table-header-group');
    expect(SHEET_CSS).toMatch(/\.print-body tr \{[^}]*break-inside: avoid/);
    expect(SHEET_CSS).not.toMatch(/print-body > div > div > div/);
  });

  it('writes callout and chip tones as tokens, which happy-dom cannot resolve', () => {
    expect(SHEET_CSS).toContain("[data-tone='goal']");
    expect(SHEET_CSS).toContain('var(--color-primary)');
    expect(SHEET_CSS).toContain('var(--color-success)');
    expect(SHEET_CSS).toContain('var(--color-warning)');
    expect(SHEET_CSS).toContain('var(--color-info)');
    expect(SHEET_CSS).toMatch(
      /\[data-block='chip'\] \{[^}]*background: color-mix\(in srgb, var\(--print-tone\) 12%/,
    );
    expect(SHEET_CSS).toMatch(
      /\[data-block='callout'\] \{[^}]*background: color-mix\(in srgb, var\(--print-tone\) 6%/,
    );
    expect(SHEET_CSS).toMatch(
      /\[data-block='callout'\] \{[^}]*border-left: 1\.5pt solid var\(--print-tone\)/,
    );
  });

  it('draws list markers itself, since WebKit clips an outside marker at the page edge', async () => {
    adoptSheet({ css: SHEET_CSS });
    await renderArtifact({ artifact: reportWithList });

    expect(styleOf({ selector: '.print-body ul' }).listStyle).toBe('none');
    expect(SHEET_CSS).toMatch(/ol > li::before \{[^}]*content: counter\(print-item\) '\.'/);
    expect(SHEET_CSS).toMatch(/ol:has\(> li:nth-child\(10\)\) > li \{/);
    expect(SHEET_CSS).toMatch(/ul > li::before \{[^}]*border-radius: 50%/);
    expect(SHEET_CSS).not.toContain('::marker');
  });

  it('prints task items with their box instead of a bullet', () => {
    expect(SHEET_CSS).toMatch(/li\[data-task\]::before \{[^}]*content: none/);
    expect(SHEET_CSS).toMatch(/li\[data-task='done'\] \[data-block='task-mark'\]/);
  });

  it('pins table cells to the table leading, not the absolute one of text-sm', () => {
    expect(SHEET_CSS).toMatch(/\.print-body td \{[^}]*line-height: inherit/);
    expect(SHEET_CSS).toMatch(/\.print-body td \{[^}]*overflow-wrap: break-word/);
  });

  it('drops a separator that sits right before a ruled section', () => {
    expect(SHEET_CSS).toContain(
      ":has(> [role='separator']:only-child):has(+ div > :is(h1, h2):first-child)",
    );
  });

  it('runs a paragraph and a list item at the same leading', async () => {
    adoptSheet({ css: SHEET_CSS });
    await renderArtifact({ artifact: reportWithList });

    const paragraph = styleOf({ selector: '.print-body p' }).lineHeight;
    const item = styleOf({ selector: '.print-body li' }).lineHeight;
    expect(paragraph).toBe('1.45');
    expect(item).toBe(paragraph);
  });
  it('keeps the callout label a flex row while its wrappers stay blocks', async () => {
    adoptSheet({ css: SHEET_CSS });
    await renderArtifact({ artifact: reportWithCallout });

    expect(styleOf({ selector: "[data-block='callout-label']" }).display).toBe('flex');
    expect(styleOf({ selector: "[data-block='callout-label']" }).alignItems).toBe('center');
    expect(styleOf({ selector: "[data-block='callout']" }).display).toBe('block');
    expect(styleOf({ selector: '.print-body > div > div' }).display).toBe('block');
  });
  it('pins the paper so a dialog default cannot redraw the layout', () => {
    expect(SHEET_CSS).toMatch(/@page \{[^@]*size: A4;/);
    expect(SHEET_CSS).toContain('size: A4 landscape');
    expect(SHEET_CSS).toMatch(/@page \{[^@]*margin: 13mm 14mm 14mm;/);
  });

  it('lets the page margin alone set the text block, with no clamp to fight it', () => {
    expect(SHEET_CSS).toMatch(/@media print \{\s*\.print-sheet \{[^}]*max-width: none;/);
    expect(SHEET_CSS).not.toContain('max-width: 150mm');
  });

  it('scales the whole document from one body size on a single ratio', () => {
    expect(SHEET_CSS).toMatch(/--print-body: 9\.5pt;/);
    expect(SHEET_CSS).toMatch(/--print-ratio: 1\.18;/);
    expect(SHEET_CSS).toMatch(
      /--print-small: calc\(var\(--print-body\) \/ var\(--print-ratio\)\);/,
    );
    expect(SHEET_CSS).toMatch(/--print-h3: calc\(var\(--print-body\) \* var\(--print-ratio\)\);/);
    expect(SHEET_CSS).toMatch(/\.print-body p \{[^}]*font-size: var\(--print-body\);/);
    expect(SHEET_CSS).toMatch(/\.print-body li \{[^}]*font-size: var\(--print-body\);/);
    expect(SHEET_CSS).toMatch(/\.print-body pre \{[^}]*font-size: var\(--print-small\);/);
    expect(SHEET_CSS).toMatch(/\[data-block='tree'\] \{[^}]*font-size: var\(--print-small\);/);
  });

  it('takes every colour from a token, so the sheet follows the light theme', () => {
    expect(SHEET_CSS).toMatch(/--print-ink: var\(--color-foreground\);/);
    expect(SHEET_CSS).toMatch(/--print-paper: var\(--color-elevated\);/);
    expect(SHEET_CSS).toMatch(/--print-accent: var\(--color-primary\);/);
    expect(SHEET_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('keeps a printed link legible instead of leaving it to the app stylesheet', () => {
    expect(SHEET_CSS).toMatch(/\.print-body a \{[^}]*text-decoration: underline;/);
    expect(SHEET_CSS).toMatch(/\.print-body a \{[^}]*color: var\(--print-accent\);/);
  });

  it('drops the image loader card, so no dead button reaches the paper', () => {
    expect(SHEET_CSS).toContain('lucide-image-off');
    expect(SHEET_CSS).toMatch(/content: 'Image omitted: ';/);
    expect(SHEET_CSS).toMatch(/\.print-body button \{\s*display: none;/);
  });

  it('hangs a wrapped ascii tree line under the branch it continues', () => {
    expect(SHEET_CSS).toMatch(/@supports \(text-indent: -3em each-line\)/);
    expect(SHEET_CSS).toMatch(/text-indent: -3em each-line;/);
    expect(SHEET_CSS).toMatch(/padding-left: 3em;/);
  });

  it('gives a paragraph and a list item the same computed size', async () => {
    adoptSheet({ css: SHEET_CSS });
    await renderArtifact({ artifact: reportWithList });

    const paragraph = styleOf({ selector: '.print-body p' }).fontSize;
    expect(styleOf({ selector: '.print-body li' }).fontSize).toBe(paragraph);
    expect(paragraph).not.toBe('');
  });
});
