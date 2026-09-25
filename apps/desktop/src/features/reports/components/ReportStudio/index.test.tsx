// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReportStudio } from './index';

const report = {
  id: 'report-1',
  sessionId: 'session-1',
  agentId: 'agent-report',
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '# Outcome\n\nagent-1 shipped it.\n\n## Risks\n\nnone.',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
};

const renderStudio = (overrides: Record<string, unknown> = {}) =>
  render(<ReportStudio artifact={JSON.parse(JSON.stringify({ ...report, ...overrides }))} />);

afterEach(cleanup);

describe('ReportStudio', () => {
  it('renders the heading outline beside the readable body', () => {
    renderStudio();
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    expect([...outline.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Outcome',
      'Risks',
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Outcome' })).toBeDefined();
  });

  it('pins the outline rail so it survives the body scroll', () => {
    renderStudio();
    const rail = screen.getByTestId('report-outline-rail');
    expect(rail.className).toContain('sticky');
    expect(rail.className).toContain('top-0');
    expect(rail.className).toContain('self-start');
    expect(rail.className).toContain('overflow-y-auto');
  });

  it('reads the body at the document scale, not the 12px chat scale', () => {
    renderStudio();
    const prose = screen.getByTestId('artifact-prose');
    expect(prose.className).toContain('artifact-prose');
    expect(prose.innerHTML).not.toContain('text-xs');
  });

  it('shows the title once, in the header, not again as the first heading', () => {
    renderStudio({
      title: 'Rounding drift in ledger-core postings',
      sourceText:
        '# Rounding drift in ledger-core postings\n\nlead.\n\n## What was wrong\n\ndrift.',
    });
    expect(
      screen.queryByRole('heading', { name: 'Rounding drift in ledger-core postings' }),
    ).toBeNull();
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    expect([...outline.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'What was wrong',
    ]);
  });

  it('carries no edit controls, the shell header owns them', () => {
    renderStudio();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByTestId('report-regenerate')).toBeNull();
  });

  it('scrolls to the repeated heading the reader picked, not to the first of its name', () => {
    const scrolled: Array<Element> = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    renderStudio({ sourceText: '# Outcome\n\n## Risks\n\nfirst.\n\n## Risks\n\nsecond.' });
    const outline = screen.getByRole('navigation', { name: 'Report outline' });
    const entries = [...outline.querySelectorAll('button')];
    fireEvent.click(entries[2]!);
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0]).toBe(screen.getAllByRole('heading', { name: 'Risks' })[1]);
  });
});
