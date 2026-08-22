// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GhTokenStatus } from '@goodboy/types';

type GhRunResult = { stdout: string; stderr: string; exitCode: number };
type DragHandler = (event: { payload: unknown }) => void;

const STAGED_REPORT = {
  dir: '/tmp/goodboy-report-1',
  images: [
    { fileName: 'board.png', mimeType: 'image/png', path: '/tmp/goodboy-report-1/01-board.png' },
  ],
};

const mocks = vi.hoisted(() => ({
  run: vi.fn<
    (args: ReadonlyArray<string>, opts: Readonly<Record<string, unknown>>) => Promise<GhRunResult>
  >(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
  openUrl: vi.fn<(url: string) => Promise<void>>(async () => undefined),
  invoke: vi.fn<(cmd: string, args: Record<string, unknown>) => Promise<unknown>>(async () => ({
    dir: '/tmp/goodboy-report-1',
    images: [],
  })),
  showToast: vi.fn(),
  dragHandlers: Array<DragHandler>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: DragHandler) => {
      mocks.dragHandlers.push(handler);
      return () => {
        mocks.dragHandlers = mocks.dragHandlers.filter((candidate) => candidate !== handler);
      };
    },
  }),
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

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
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
  mocks.invoke.mockReset();
  mocks.invoke.mockImplementation(async () => STAGED_REPORT);
  mocks.showToast.mockReset();
  mocks.dragHandlers = [];
});
afterEach(cleanup);

describe('ReportIssueStudio', () => {
  it('keeps send disabled until version, area and title are all filled', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const send = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);

    fillReport({ title: 'Unexpected behavior' });
    expect(send().disabled).toBe(true);

    fillReport({ area: 'board-sessions' });
    expect(send().disabled).toBe(false);
  });

  it('guesses the area from drafted words until the reporter changes it', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    useAppStore.getState().setBugReportDraft({
      title: 'Budget warning is stale',
      description: 'The cost cap changed yesterday.',
    });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(screen.getByLabelText<HTMLSelectElement>('Area').value).toBe('budget-spend');
    expect(screen.getByText("Guessed from your words. Change it if it's off.")).toBeDefined();

    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'notifications' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'provider model issue' } });

    expect(screen.getByLabelText<HTMLSelectElement>('Area').value).toBe('notifications');
    expect(screen.queryByText("Guessed from your words. Change it if it's off.")).toBeNull();
  });

  it('shows exactly the version, area label, title and notes in the preview, nothing else', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({
      area: 'chat-agents',
      title: 'Agent reply is cut off',
      notes: 'The reply stops mid-sentence after a tool call.',
    });

    expect(screen.queryByRole('button', { name: /Preview/ })).toBeNull();
    expect(screen.getByText('Agent reply is cut off')).toBeDefined();
    expect(
      screen.getByText(
        'Type: Bug\nArea: Chat and agents\nVersion: 0.1.69\n\nThe reply stops mid-sentence after a tool call.',
        { normalizer: (text) => text },
      ),
    ).toBeDefined();
  });

  it('sits the category icon in the heading, immediately before the category name', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const bug = screen.getByRole('tab', { name: /Bug/ });
    const icon = bug.querySelector('svg');

    expect(icon?.nextElementSibling?.textContent).toBe('Bug');
    expect(icon?.parentElement?.textContent).toBe('Bug');
    expect(bug.textContent).toContain('Something broke');
  });

  it('renders the compact file drop action across the available width', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const addFiles = screen.getByRole('button', { name: 'Add files or drag' });

    expect(addFiles.className).toContain('w-full');
    expect(addFiles.className).toContain('justify-center');
    expect(addFiles.className).toContain('h-8');
  });

  it('adds an image dropped on the report image area', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    mocks.invoke.mockImplementation(async (command) =>
      command === 'attachment_read_dropped'
        ? {
            fileName: 'dropped.png',
            mimeType: 'image/png',
            dataBase64: 'aGk=',
          }
        : STAGED_REPORT,
    );
    render(<ReportIssueStudio onClose={vi.fn()} />);

    await act(async () => {
      mocks.dragHandlers.forEach((handler) => {
        handler({
          payload: {
            type: 'drop',
            position: { x: 100, y: 100 },
            paths: ['/tmp/dropped.png'],
          },
        });
      });
    });

    expect(screen.getByAltText('dropped.png')).toBeDefined();
  });

  it('puts the actions at the end of the content rather than docking them to the pane', () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    const preview = screen.getByRole('region', { name: 'Preview' });
    const footer = screen.getByRole('button', { name: 'Send' }).closest('footer');
    const measure = preview.closest('.max-w-2xl');

    expect(measure).not.toBeNull();
    expect(measure?.contains(footer as Node)).toBe(true);
    expect(preview.nextElementSibling).toBe(footer);
  });

  const issueCreateArgs = (): ReadonlyArray<string> =>
    mocks.run.mock.calls.map((call) => call[0]).find((args) => args[0] === 'issue') ?? [];

  const attachOneImage = () => {
    useAppStore.getState().addBugReportImages({
      images: [
        {
          id: 'shot-1',
          fileName: 'board.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          dataUrl: 'data:image/png;base64,AAAA',
        },
      ],
    });
  };

  it('shows the images attached in the popover and names them in the issue body', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
    mocks.run.mockImplementation(async () => ({
      stdout: 'https://github.com/akhayam99/goodboy/issues/99\n',
      stderr: '',
      exitCode: 0,
    }));
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(screen.getByAltText('board.png')).toBeDefined();

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(issueCreateArgs()).toContain(
      'Type: Bug\nArea: Board and sessions\nVersion: 0.1.69\n\nFreezes on archive.\n\nScreenshots to drag into this issue: board.png',
    );
  });

  it('embeds the uploaded screenshots in the issue and drops the drag reminder', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
    mocks.invoke.mockImplementation(async () => STAGED_REPORT);
    mocks.run.mockImplementation(async (args) => {
      if (args[0] === 'api' && args[1] === 'repos/akhayam99/goodboy') {
        return { stdout: '1231334462\n', stderr: '', exitCode: 0 };
      }
      if (args[0] === 'api') {
        return {
          stdout: '{"url":"https://github.com/user-attachments/assets/aaa"}',
          stderr: '',
          exitCode: 0,
        };
      }
      return {
        stdout: 'https://github.com/akhayam99/goodboy/issues/99\n',
        stderr: '',
        exitCode: 0,
      };
    });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    const body = issueCreateArgs().at(-1) ?? '';
    expect(body).toContain('![board.png](https://github.com/user-attachments/assets/aaa)');
    expect(body).not.toContain('Screenshots to drag into this issue');
    expect(mocks.showToast).toHaveBeenCalledWith(
      'success',
      'Filed on GitHub with your images, under your account.',
      expect.objectContaining({ title: 'Issue sent' }),
    );
    expect(mocks.invoke).toHaveBeenCalledWith('bug_report_discard_images', {
      dir: '/tmp/goodboy-report-1',
    });
  });

  it('falls back to the drag reminder when the upload does not go through', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
    mocks.invoke.mockImplementation(async () => STAGED_REPORT);
    mocks.run.mockImplementation(async (args) => {
      if (args[0] === 'api' && args[1] === 'repos/akhayam99/goodboy') {
        return { stdout: '1231334462\n', stderr: '', exitCode: 0 };
      }
      if (args[0] === 'api') {
        return { stdout: '', stderr: 'gone', exitCode: 1 };
      }
      return {
        stdout: 'https://github.com/akhayam99/goodboy/issues/99\n',
        stderr: '',
        exitCode: 0,
      };
    });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(issueCreateArgs().at(-1) ?? '').toContain(
      'Screenshots to drag into this issue: board.png',
    );
    expect(mocks.showToast).toHaveBeenCalledWith(
      'success',
      "Your images aren't on it yet. GitHub only takes them by drag and drop.",
      expect.objectContaining({ persist: true }),
    );
    expect(mocks.invoke).not.toHaveBeenCalledWith('bug_report_discard_images', expect.anything());
  });

  it('does not promise an upload the browser path cannot make', () => {
    setGithubStatus({ available: false, mode: 'absent' });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    expect(screen.getByText(/The GitHub form cannot carry them/)).toBeDefined();
  });

  it('writes the attached image bytes out to a folder before the issue is filed', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
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

    expect(mocks.invoke).toHaveBeenCalledWith('bug_report_stage_images', {
      images: [{ fileName: 'board.png', mimeType: 'image/png', dataBase64: 'AAAA' }],
    });
  });

  it('keeps an image reminder until its action reveals the staged folder', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
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

    expect(mocks.showToast).toHaveBeenCalledWith(
      'success',
      "Your images aren't on it yet. GitHub only takes them by drag and drop.",
      expect.objectContaining({
        title: 'Issue sent',
        persist: true,
        action: expect.objectContaining({ label: 'Open issue and images' }),
      }),
    );
  });

  it('stages the images on the fallback path too, where the link cannot carry them', async () => {
    setGithubStatus({ available: false, mode: 'absent' });
    attachOneImage();
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
    });

    expect(mocks.invoke).toHaveBeenCalledWith('bug_report_stage_images', {
      images: [{ fileName: 'board.png', mimeType: 'image/png', dataBase64: 'AAAA' }],
    });
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
  });

  it('files nothing and keeps the draft when the images cannot be written out', async () => {
    setGithubStatus({ available: true, mode: 'gh-cli' });
    attachOneImage();
    mocks.invoke.mockImplementation(async () => {
      throw new Error('disk is full');
    });
    render(<ReportIssueStudio onClose={vi.fn()} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });

    expect(mocks.run).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('disk is full');
    expect(useAppStore.getState().bugReportDraft.images).toHaveLength(1);
  });

  it('never reaches for the file system when no image is attached', async () => {
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

    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('sends directly through gh and offers the created issue without opening it', async () => {
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
    expect(mocks.openUrl).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(
      'success',
      'Filed on GitHub, under your account.',
      expect.objectContaining({ title: 'Issue sent' }),
    );
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

  it('empties the draft and leaves the form once the fallback link opens', async () => {
    setGithubStatus({ available: false, mode: 'absent' });
    const onClose = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ReportIssueStudio onClose={onClose} />);

    fillReport({ area: 'board-sessions', title: 'Board freeze', notes: 'Freezes on archive.' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on GitHub' }));
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
      screen.getByText('v0.1.69 · Posts publicly on GitHub, under your account'),
    ).toBeDefined();
  });
});
