// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { ReportStudio } from './index';

const SESSION_ID = 'session-1' as SessionId;

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
  render(
    <ReportStudio
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify({ ...report, ...overrides }))}
    />,
  );

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

  it('renders the report through the document template, not the chat markdown scale', () => {
    renderStudio();
    const document = screen.getByTestId('artifact-document');
    expect(document.getAttribute('data-medium')).toBe('screen');
    expect(document.innerHTML).not.toContain('text-xs');
  });

  it('shows the title once, in the document letterhead, not again as a body heading', () => {
    renderStudio({
      title: 'Rounding drift in ledger-core postings',
      sourceText:
        '# Rounding drift in ledger-core postings\n\nlead.\n\n## What was wrong\n\ndrift.',
    });
    expect(
      screen.getAllByRole('heading', { name: 'Rounding drift in ledger-core postings' }),
    ).toHaveLength(1);
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
