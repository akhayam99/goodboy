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

type PxParams = {
  readonly selector: string;
  readonly property: 'paddingLeft';
};

const pxOf = ({ selector, property }: PxParams): number => {
  const parsed = Number.parseFloat(styleOf({ selector })[property]);
  return Number.isNaN(parsed) ? 0 : parsed;
};

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

    expect(styleOf({ selector: '.print-sheet' }).paddingLeft).toBe('36px');
    expect(styleOf({ selector: '.print-sheet' }).maxWidth).toBe('672px');
    expect(styleOf({ selector: '.print-eyebrow' }).display).toBe('flex');
    expect(styleOf({ selector: '.print-meta' }).display).toBe('flex');
    expect(styleOf({ selector: '.print-title' }).fontWeight).toBe('600');
    expect(styleOf({ selector: '.print-contents-list' }).listStyle).toBe('decimal');
    expect(pxOf({ selector: '.print-contents-list', property: 'paddingLeft' })).toBeGreaterThan(0);
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

    expect(styleOf({ selector: '.print-sheet' }).paddingLeft).not.toBe('36px');
    expect(styleOf({ selector: '.print-meta' }).display).not.toBe('flex');
    expect(styleOf({ selector: '.print-contents-list' }).listStyle).not.toBe('decimal');
    expect(pxOf({ selector: '.print-contents-list', property: 'paddingLeft' })).toBe(0);
  });

  it('widens the sheet for a landscape wireframe from the same stylesheet', async () => {
    adoptSheet({ css: SHEET_CSS });
    listSpy.mockResolvedValueOnce([wideWireframe]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByTestId('print-wireframe-sheet')).toBeDefined();
    });

    expect(screen.getByTestId('artifact-print-view').getAttribute('data-page')).toBe('landscape');
    expect(styleOf({ selector: '.print-sheet' }).maxWidth).toBe('1024px');
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
    expect(SHEET_CSS).toMatch(/\[data-block='chip'\] \{[^}]*background: none/);
    expect(SHEET_CSS).toMatch(/\[data-block='callout'\] \{[^}]*background: none/);
  });

  it('runs a paragraph and a list item at the same leading', async () => {
    adoptSheet({ css: SHEET_CSS });
    await renderArtifact({ artifact: reportWithList });

    const paragraph = styleOf({ selector: '.print-body p' }).lineHeight;
    const item = styleOf({ selector: '.print-body li' }).lineHeight;
    expect(paragraph).toBe('1.5');
    expect(item).toBe(paragraph);
  });
});
