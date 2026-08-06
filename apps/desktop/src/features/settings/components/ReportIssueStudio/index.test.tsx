// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GhTokenStatus } from '@goodboy/types';

type GhRunResult = { stdout: string; stderr: string; exitCode: number };

const mocks = vi.hoisted(() => ({
  githubStatus: null as GhTokenStatus | null,
  refreshGithubStatus: vi.fn(async () => undefined),
  run: vi.fn<
    (args: ReadonlyArray<string>, opts: Readonly<Record<string, unknown>>) => Promise<GhRunResult>
  >(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  openUrl: vi.fn<(url: string) => Promise<void>>(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (state: {
      githubStatus: GhTokenStatus | null;
      refreshGithubStatus: typeof mocks.refreshGithubStatus;
    }) => T,
  ) =>
    selector({ githubStatus: mocks.githubStatus, refreshGithubStatus: mocks.refreshGithubStatus }),
}));

vi.mock('../../../changelog/hooks/useInstalledVersion', () => ({
  useInstalledVersion: () => '0.1.69',
}));

vi.mock('../../../github/github', () => ({
  tauriGhRunner: { run: mocks.run },
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: mocks.openUrl,
}));

import { ReportIssueStudio } from './index';

const fillReport = ({ area, title, notes }: { area?: string; title?: string; notes?: string }) => {
  if (area != null) {
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: area } });
  }
  if (title != null) {
    fireEvent.change(screen.getByPlaceholderText("What's wrong, in one line"), {
      target: { value: title },
    });
  }
  if (notes != null) {
    fireEvent.change(
      screen.getByPlaceholderText('Steps to reproduce, what you expected, what happened instead'),
      { target: { value: notes } },
    );
  }
};

beforeEach(() => {
  mocks.githubStatus = null;
  mocks.refreshGithubStatus = vi.fn(async () => undefined);
  mocks.run.mockReset();
  mocks.run.mockImplementation(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
  mocks.openUrl.mockReset();
  mocks.openUrl.mockImplementation(async () => undefined);
});
afterEach(cleanup);

describe('ReportIssueStudio', () => {
  it('keeps send disabled until version, area and title are all filled', () => {
    mocks.githubStatus = { available: true, mode: 'gh-cli' };
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const send = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);

    fillReport({ title: 'Board freezes' });
    expect(send().disabled).toBe(true);

    fillReport({ area: 'board-sessions' });
    expect(send().disabled).toBe(false);
  });

  it('shows exactly the version, area label, title and notes in the preview, nothing else', () => {
    mocks.githubStatus = { available: true, mode: 'gh-cli' };
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({
      area: 'chat-agents',
      title: 'Agent reply is cut off',
      notes: 'The reply stops mid-sentence after a tool call.',
    });

    expect(screen.getByText('Agent reply is cut off')).toBeDefined();
    expect(
      screen.getByText(
        'Area: Chat and agents\nVersion: 0.1.69\n\nThe reply stops mid-sentence after a tool call.',
        { normalizer: (text) => text },
      ),
    ).toBeDefined();
  });

  it('sends directly through gh when connected, and offers the created issue link', async () => {
    mocks.githubStatus = { available: true, mode: 'gh-cli' };
    mocks.run.mockImplementation(async () => ({
      stdout: 'https://github.com/akhayam99/goodboy/issues/99\n',
      stderr: '',
      exitCode: 0,
    }));
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(mocks.run).toHaveBeenCalledWith(
      [
        'issue',
        'create',
        '--repo',
        'akhayam99/goodboy',
        '--title',
        'Board freeze',
        '--body',
        'Area: Board and sessions\nVersion: 0.1.69\n\nFreezes on archive.',
      ],
      {},
    );
    expect(screen.getByRole('button', { name: /open on github/i })).toBeDefined();
  });

  it('surfaces the gh stderr message when the direct send fails', async () => {
    mocks.githubStatus = { available: true, mode: 'gh-cli' };
    mocks.run.mockImplementation(async () => ({
      stdout: '',
      stderr: 'HTTP 403: Resource not accessible',
      exitCode: 1,
    }));
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(screen.getByRole('alert').textContent).toContain('HTTP 403: Resource not accessible');
  });

  it('opens a url the native validator would accept when github is not connected', async () => {
    mocks.githubStatus = { available: false, mode: 'absent' };
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
    });

    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    const [url] = mocks.openUrl.mock.calls[0] as [string];
    expect(url.startsWith('https://github.com/akhayam99/goodboy/issues/new?')).toBe(true);
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(/[\s"<>`|\\^{}]/.test(url)).toBe(false);
  });

  it('truncates an overlong note visibly on the fallback path', async () => {
    mocks.githubStatus = { available: false, mode: 'absent' };
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const longNotes = 'x'.repeat(6000);
    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: longNotes });

    expect(screen.getByText(/trimmed to fit the github link/i)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
    });

    const [url] = mocks.openUrl.mock.calls[0] as [string];
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(url).not.toContain('x'.repeat(6000));
  });
});
