// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GhTokenStatus } from '@goodboy/types';

type GhRunResult = { stdout: string; stderr: string; exitCode: number };

const mocks = vi.hoisted(() => ({
  run: vi.fn<
    (args: ReadonlyArray<string>, opts: Readonly<Record<string, unknown>>) => Promise<GhRunResult>
  >(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  openUrl: vi.fn<(url: string) => Promise<void>>(async () => undefined),
}));

vi.mock('../../../../store', async () => {
  const { create } = await import('zustand');
  const { createBugReportDraftSlice } = await import('../../../../store/slices/bugReportDraft');
  const { initialBugReportDraftState } =
    await import('../../../../store/slices/bugReportDraft/state');
  const useAppStore = create((set, get) => ({
    ...initialBugReportDraftState,
    ...createBugReportDraftSlice(set as never, get as never),
    githubStatus: null,
    refreshGithubStatus: async () => undefined,
  }));
  return { useAppStore };
});

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
import { useAppStore } from '../../../../store';
import { initialBugReportDraftState } from '../../../../store/slices/bugReportDraft/state';

const setGithubStatus = (githubStatus: GhTokenStatus | null) => {
  useAppStore.setState({ githubStatus });
};

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
  useAppStore.setState({ ...initialBugReportDraftState, githubStatus: null });
  mocks.run.mockReset();
  mocks.run.mockImplementation(async () => ({ stdout: '', stderr: '', exitCode: 0 }));
  mocks.openUrl.mockReset();
  mocks.openUrl.mockImplementation(async () => undefined);
});
afterEach(cleanup);

describe('ReportIssueStudio', () => {
  it('keeps send disabled until version, area and title are all filled', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const send = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);

    fillReport({ title: 'Board freezes' });
    expect(send().disabled).toBe(true);

    fillReport({ area: 'board-sessions' });
    expect(send().disabled).toBe(false);
  });

  it('shows exactly the version, area label, title and notes in the preview, nothing else', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({
      area: 'chat-agents',
      title: 'Agent reply is cut off',
      notes: 'The reply stops mid-sentence after a tool call.',
    });

    expect(screen.getByText('Agent reply is cut off')).toBeDefined();
    expect(
      screen.getByText(
        'Type: Bug\nArea: Chat and agents\nVersion: 0.1.69\n\nThe reply stops mid-sentence after a tool call.',
        { normalizer: (text) => text },
      ),
    ).toBeDefined();
  });

  it('sends directly through gh when connected, and opens the created issue', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
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
        'Type: Bug\nArea: Board and sessions\nVersion: 0.1.69\n\nFreezes on archive.',
      ],
      {},
    );
    expect(mocks.openUrl).toHaveBeenCalledWith('https://github.com/akhayam99/goodboy/issues/99');
  });

  it('empties the draft and leaves the form once the issue is filed', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    mocks.run.mockImplementation(async () => ({
      stdout: 'https://github.com/akhayam99/goodboy/issues/99\n',
      stderr: '',
      exitCode: 0,
    }));
    const onClose = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ReportIssueStudio onClose={onClose} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    vi.useRealTimers();

    expect(onClose).toHaveBeenCalledOnce();
    expect(useAppStore.getState().bugReportDraft).toEqual(
      initialBugReportDraftState.bugReportDraft,
    );
  });

  it('keeps the draft when the send fails, so nothing typed is lost', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
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

    expect(useAppStore.getState().bugReportDraft.description).toBe('Freezes on archive.');
  });

  it('surfaces the gh stderr message when the direct send fails', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
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
    setGithubStatus({ available: false, mode: 'absent' });
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
    setGithubStatus({ available: false, mode: 'absent' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const longNotes = 'x'.repeat(6000);
    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: longNotes });

    expect(screen.getByText(/notes trimmed to fit the github link/i)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
    });

    const [url] = mocks.openUrl.mock.calls[0] as [string];
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(url).not.toContain('x'.repeat(6000));
  });

  it('trims an overlong title, says so, and still opens a url under the cap', async () => {
    setGithubStatus({ available: false, mode: 'absent' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'T'.repeat(5000), notes: 'Freezes on archive.' });

    expect(screen.getByText(/title trimmed to fit the github link/i)).toBeDefined();
    expect(screen.getByText(/^T+…$/)).toBeDefined();
    expect(
      screen.getByText(
        'Type: Bug\nArea: Board and sessions\nVersion: 0.1.69\n\nFreezes on archive.',
        {
          normalizer: (text) => text,
        },
      ),
    ).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
    });

    expect(screen.queryByRole('alert')).toBeNull();
    const [url] = mocks.openUrl.mock.calls[0] as [string];
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(/[\s"<>`|\\^{}]/.test(url)).toBe(false);
  });

  it('renders a lone surrogate in the notes instead of crashing, on the fallback path', () => {
    setGithubStatus({ available: false, mode: 'absent' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'a\uD83D b' });

    expect(screen.getByRole('button', { name: 'Open on GitHub' })).toBeDefined();
  });

  it('renders a lone surrogate in the notes instead of crashing, on the direct path', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'a\uD83D b' });

    expect(screen.getByRole('button', { name: 'Send' }).hasAttribute('disabled')).toBe(false);
  });

  it('names the CLI login only when the CLI is what sends it', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(screen.getByText('Sent directly, using your GitHub CLI login.')).toBeDefined();
  });

  it('says token, not CLI login, when a personal access token is what sends it', () => {
    setGithubStatus({ available: true, mode: 'pat' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(screen.getByText('Sent directly, using your GitHub token.')).toBeDefined();
    expect(screen.queryByText(/CLI login/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
  });

  it('never claims a CLI login in the truncation notice', () => {
    setGithubStatus({ available: false, mode: 'absent' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'x'.repeat(6000) });

    expect(screen.getByText(/Connect GitHub to send the full text\./)).toBeDefined();
    expect(screen.queryByText(/GitHub CLI/)).toBeNull();
  });

  it('discloses that the report is posted publicly under the reporter account', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(
      screen.getByText('This posts publicly on GitHub, under your own account.'),
    ).toBeDefined();
  });
});
