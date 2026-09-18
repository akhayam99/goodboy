// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ArtifactId, SessionId } from '@goodboy/types';

const { listSpy, closeSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(async (_sessionId: string) => [] as ReadonlyArray<Record<string, unknown>>),
  closeSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../artifacts/artifacts', () => ({
  listArtifactsForSession: (sessionId: string) => listSpy(sessionId),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: () => closeSpy() }),
}));

import { ArtifactPrintView } from './index';

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
  sourceText: '# Outcome',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: '2026-09-15T10:00:00',
  updatedAt: '2026-09-15T10:00:00',
};

const wireframeDocument = {
  version: 1,
  initialScreenId: 'sign-in',
  theme: { name: 'harborline', font: 'sans', radius: 'md' },
  screens: [
    {
      id: 'sign-in',
      title: 'Sign in',
      viewport: 'mobile',
      root: {
        id: 'sign-in-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'sign-in-heading', kind: 'text', text: 'Harborline', variant: 'title' }],
      },
    },
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
};

const wireframe = {
  ...report,
  id: 'report-1',
  kind: 'wireframe',
  title: 'Harborline onboarding',
  sourceFormat: 'json',
  sourceText: JSON.stringify(wireframeDocument),
  metadata: { fidelity: 'low', designProfile: {} },
};

afterEach(cleanup);

describe('ArtifactPrintView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
    document.getElementById('boot-shell')?.remove();
    const shell = document.createElement('div');
    shell.id = 'boot-shell';
    document.body.append(shell);
  });

  it('removes the boot shell so the splash never prints over the document', async () => {
    listSpy.mockResolvedValueOnce([report]);
    expect(document.getElementById('boot-shell')).not.toBeNull();
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(document.getElementById('boot-shell')).toBeNull();
    });
  });

  it('drops a leading heading that repeats the title', async () => {
    listSpy.mockResolvedValueOnce([
      { ...report, sourceText: '#  session report!\n\nwhat landed this week' },
    ]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByText('what landed this week')).toBeDefined();
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps a leading heading that is not the title', async () => {
    listSpy.mockResolvedValueOnce([{ ...report, sourceText: '# Outcome\n\nwhat landed' }]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Outcome' })).toBeDefined();
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(2);
  });

  it('lays the facts out as labelled fields, with a human date and no raw timestamp', async () => {
    listSpy.mockResolvedValueOnce([report]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByText('September 15, 2026 at 10:00 AM')).toBeDefined();
    });
    expect(screen.getByText('Document').tagName).toBe('DT');
    expect(screen.getByText('Session summary').tagName).toBe('DD');
    expect(screen.getByText('Revision').tagName).toBe('DT');
    expect(screen.getByText('Prepared').tagName).toBe('DT');
    expect(document.body.textContent).not.toContain('2026-09-15T10:00:00');
  });

  it('gives a long report a contents block built from its own sections', async () => {
    listSpy.mockResolvedValueOnce([
      {
        ...report,
        sourceText: '## What shipped\n\ntext\n\n## Checks\n\ntext\n\n## Risk\n\ntext',
      },
    ]);
    render(<ArtifactPrintView request={request} />);
    const contents = await waitFor(() => screen.getByRole('navigation', { name: 'Contents' }));
    expect(contents.textContent).toContain('What shipped');
    expect(contents.textContent).toContain('Checks');
    expect(contents.textContent).toContain('Risk');
  });

  it('lists a marked-up heading in the contents exactly as the heading renders', async () => {
    listSpy.mockResolvedValueOnce([
      {
        ...report,
        sourceText: [
          '## **Checks**',
          '',
          'text',
          '',
          '## [Risk](https://example.com/risk)',
          '',
          'text',
          '',
          '## `deploy` notes',
          '',
          'text',
        ].join('\n'),
      },
    ]);
    render(<ArtifactPrintView request={request} />);
    const contents = await waitFor(() => screen.getByRole('navigation', { name: 'Contents' }));
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Checks',
      'Risk',
      'deploy notes',
    ]);
    expect(contents.textContent).toContain('Checks');
    expect(contents.textContent).toContain('Risk');
    expect(contents.textContent).toContain('deploy notes');
    expect(contents.textContent).not.toContain('**');
    expect(contents.textContent).not.toContain('](');
    expect(contents.textContent).not.toContain('`');
  });

  it('leaves a short report without a contents block', async () => {
    listSpy.mockResolvedValueOnce([
      { ...report, sourceText: '## Only section\n\ntext\n\n## Second\n\ntext' },
    ]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Only section' })).toBeDefined();
    });
    expect(screen.queryByRole('navigation', { name: 'Contents' })).toBeNull();
  });

  it('renders the report in a light print sheet and triggers the print dialog once', async () => {
    listSpy.mockResolvedValueOnce([report]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Session report' })).toBeDefined();
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-print-window')).toBe('true');
    await waitFor(() => {
      expect(window.print).toHaveBeenCalledTimes(1);
    });
  });

  it('unclamps the window it marks so a tall sheet scrolls on screen', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(styles).toMatch(/@media screen \{\s*html\[data-print-window\][^}]*overflow: auto;/);
    expect(styles).toMatch(/html,\s*body,\s*#root \{[^}]*overflow: hidden;/);
  });

  it('closes the print window on escape and stops listening once it is gone', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    listSpy.mockResolvedValueOnce([report]);
    const { unmount } = render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Session report' })).toBeDefined();
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(closeSpy).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(window.print).toHaveBeenCalledTimes(1);
    });

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('says the source is still safe when printing is unsupported', async () => {
    listSpy.mockResolvedValueOnce([report]);
    window.print = vi.fn(() => {
      throw new Error('print is not implemented');
    });
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('could not open a print dialog');
    });
    expect(screen.getByRole('alert').textContent).toContain('nothing was lost');
  });

  it('lays a wireframe out as a contact sheet under the same letterhead', async () => {
    listSpy.mockResolvedValueOnce([wireframe]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Harborline onboarding' }),
      ).toBeDefined();
    });
    const frames = screen.getAllByTestId('wireframe-sheet-frame');
    expect(frames.map((frame) => frame.getAttribute('data-screen-id'))).toEqual([
      'sign-in',
      'console',
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await waitFor(() => {
      expect(window.print).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses a wireframe it cannot read instead of dumping its source', async () => {
    listSpy.mockResolvedValueOnce([{ ...wireframe, sourceText: '{"screens":[]}' }]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('does not match the schema');
    });
    expect(screen.queryByText('{"screens":[]}')).toBeNull();
    expect(screen.queryByTestId('wireframe-sheet-frame')).toBeNull();
    expect(window.print).not.toHaveBeenCalled();
  });

  it('reports a missing artifact instead of printing an empty page', async () => {
    listSpy.mockResolvedValueOnce([]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no longer in the session');
    });
    expect(window.print).not.toHaveBeenCalled();
  });

  it('prints a desktop only wireframe on a landscape page and keeps it inert', async () => {
    const desktopOnly = {
      ...wireframeDocument,
      initialScreenId: 'console',
      screens: [wireframeDocument.screens[1]],
    };
    listSpy.mockResolvedValueOnce([{ ...wireframe, sourceText: JSON.stringify(desktopOnly) }]);
    const { container } = render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByTestId('print-wireframe-sheet')).toBeDefined();
    });
    expect(screen.getByTestId('print-wireframe-sheet').getAttribute('data-page')).toBe('landscape');
    expect(screen.getByTestId('artifact-print-view').getAttribute('data-page')).toBe('landscape');
    expect(container.querySelectorAll('[inert]')).toHaveLength(1);
  });

  it('keeps a mixed wireframe on the portrait page the report uses', async () => {
    listSpy.mockResolvedValueOnce([wireframe]);
    render(<ArtifactPrintView request={request} />);
    await waitFor(() => {
      expect(screen.getByTestId('print-wireframe-sheet')).toBeDefined();
    });
    expect(screen.getByTestId('print-wireframe-sheet').getAttribute('data-page')).toBe('portrait');
    expect(screen.getByTestId('artifact-print-view').getAttribute('data-page')).toBe('portrait');
  });
});
