// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderId, Session, SessionId } from '@goodboy/types';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

type Store = {
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly selectAgent: ReturnType<typeof vi.fn>;
  readonly providers: ReadonlyArray<{
    readonly id: ProviderId;
    readonly connection: string;
  }>;
  readonly sessions: ReadonlyArray<Session>;
  readonly workspaceOverrides: Readonly<Record<string, unknown>>;
};

const h = vi.hoisted(() => ({
  exploreList: vi.fn(),
  exploreOpen: vi.fn(),
  exploreRead: vi.fn(),
  spawnAgent: vi.fn<
    (
      sessionId: SessionId,
      args: { readonly model: string; readonly initialPrompt: string },
    ) => Promise<string>
  >(async () => 'agent-1'),
  selectAgent: vi.fn(async () => undefined),
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
  providers: [{ id: 'anthropic' as ProviderId, connection: 'connected' }],
  sessions: [
    {
      id: 'session-1' as SessionId,
      workspaceId: 'workspace-1',
      goal: 'Look at the documents',
      state: { kind: 'idle', lastActivityAt: '2026-08-02T00:00:00.000Z' },
      contextSlots: [],
      providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
      permissionMode: 'bypassPermissions',
      autoRun: false,
      titleUserEdited: false,
      workflowRuns: [],
      createdAt: '2026-08-02T00:00:00.000Z',
      updatedAt: '2026-08-02T00:00:00.000Z',
    } as unknown as Session,
  ],
}));

vi.mock('../../explore', () => ({
  exploreList: h.exploreList,
  exploreOpen: h.exploreOpen,
  exploreRead: h.exploreRead,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      spawnAgent: h.spawnAgent,
      selectAgent: h.selectAgent,
      providers: h.providers,
      sessions: h.sessions,
      workspaceOverrides: {},
    }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
    CopyButton: ({ value, label }: { readonly value: string; readonly label: string }) => (
      <button type="button" aria-label={`copy ${label}`}>
        {value}
      </button>
    ),
  };
});

import { ExplorePane } from '.';

const SESSION_ID = 'session-1' as SessionId;

beforeEach(() => {
  h.exploreList.mockReset();
  h.exploreOpen.mockReset();
  h.exploreRead.mockReset();
  h.spawnAgent.mockReset();
  h.spawnAgent.mockResolvedValue('agent-1');
  h.selectAgent.mockClear();
  h.showToast.mockClear();
  h.providers = [{ id: 'anthropic' as ProviderId, connection: 'connected' }];
});

afterEach(cleanup);

describe('ExplorePane', () => {
  it('lists returned entries and loads a directory only when expanded', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'docs',
        relPath: 'docs',
        isDir: true,
        sizeBytes: 0,
        modifiedAt: '2026-07-21T10:00:00Z',
      },
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 24,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'README.md',
        relPath: 'docs/README.md',
        isDir: false,
        sizeBytes: 10,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() =>
      expect(h.exploreList).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: '',
      }),
    );
    expect(screen.getByText('docs')).toBeDefined();
    expect(screen.getByText('notes.txt')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Expand docs' }));

    await waitFor(() =>
      expect(h.exploreList).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: 'docs',
      }),
    );
    expect(screen.getByText('README.md')).toBeDefined();
  });

  it('shows listing errors instead of the empty state', async () => {
    h.exploreList.mockRejectedValueOnce(new Error('io error: permission denied'));

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() =>
      expect(screen.getByText('Could not read this session folder')).toBeDefined(),
    );
    expect(screen.getByText('io error: permission denied')).toBeDefined();
    expect(screen.queryByText('This session folder is empty')).toBeNull();
  });

  it('renders markdown as markdown, text as text, and offers external open for unsupported files', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'README.md',
        relPath: 'README.md',
        isDir: false,
        sizeBytes: 21,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
      {
        name: 'notes.log',
        relPath: 'notes.log',
        isDir: false,
        sizeBytes: 42,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
      {
        name: 'budget.xlsx',
        relPath: 'budget.xlsx',
        isDir: false,
        sizeBytes: 1200,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    h.exploreRead.mockResolvedValueOnce({
      type: 'text',
      text: '# Read me\n\nMarkdown body',
      truncated: false,
    });
    h.exploreRead.mockResolvedValueOnce({
      type: 'text',
      text: 'line one\nline two',
      truncated: false,
    });

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('README.md')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Preview README.md' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Read me' })).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Preview notes.log' }));
    await waitFor(() => expect(screen.getByText(/line one/)).toBeDefined());
    expect(screen.getByText(/line two/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Preview budget.xlsx' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Preview is not available for this format. Open it in the app that owns it.',
        ),
      ).toBeDefined(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open this file outside the app' }));
    await waitFor(() =>
      expect(h.exploreOpen).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: 'budget.xlsx',
        reveal: false,
      }),
    );
  });

  it('labels truncated text previews', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'large.txt',
        relPath: 'large.txt',
        isDir: false,
        sizeBytes: 320000,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    h.exploreRead.mockResolvedValueOnce({
      type: 'text',
      text: 'trimmed',
      truncated: true,
    });

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('large.txt')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Preview large.txt' }));
    await waitFor(() => expect(screen.getByText('Preview is truncated to 256 KB.')).toBeDefined());
  });

  it('spawns from a file with the selected model and a prompt that includes ask and path', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'budget.xlsx',
        relPath: 'budget.xlsx',
        isDir: false,
        sizeBytes: 1200,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('budget.xlsx')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent to work on budget.xlsx' }));

    fireEvent.change(
      screen.getByRole('textbox', { name: 'What should the agent do with this file?' }),
      {
        target: { value: 'Analyze this spreadsheet and summarize trends.' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Agent settings:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spawn agent' }));

    await waitFor(() => expect(h.spawnAgent).toHaveBeenCalled());
    const spawnArgs = h.spawnAgent.mock.calls.at(-1)?.[1] as
      | { readonly model: string; readonly initialPrompt: string; readonly focus: string }
      | undefined;
    expect(spawnArgs?.focus).toBe('none');
    expect(spawnArgs?.model).toBe('claude-opus-5');
    expect(spawnArgs?.initialPrompt).toContain('Analyze this spreadsheet and summarize trends.');
    expect(spawnArgs?.initialPrompt).toContain('- budget.xlsx');
    expect(
      (spawnArgs?.initialPrompt.indexOf('Analyze this spreadsheet and summarize trends.') ?? 0) <
        (spawnArgs?.initialPrompt.indexOf('- budget.xlsx') ?? 0),
    ).toBe(true);
    expect(h.selectAgent).not.toHaveBeenCalled();

    const action = h.showToast.mock.calls[0]![2]?.action;
    expect(action?.label).toBe('Open the agent');
    action?.onClick();

    expect(h.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
  });

  it('keeps spawn disabled when the ask is empty', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent to work on notes.txt' }));
    expect(screen.getByRole('button', { name: 'Spawn agent' }).hasAttribute('disabled')).toBe(true);
  });

  it('hides row actions until hover or keyboard focus, but keeps them focusable and working', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    const revealButton = screen.getByRole('button', {
      name: 'Reveal notes.txt in file manager',
    });
    const actionsWrapper = revealButton.parentElement;
    expect(actionsWrapper?.className).toContain('opacity-0');
    expect(actionsWrapper?.className).toContain('group-focus-within/explore-row:opacity-100');
    expect(actionsWrapper?.className).toContain('group-hover/explore-row:opacity-100');

    revealButton.focus();
    expect(document.activeElement).toBe(revealButton);

    fireEvent.click(revealButton);
    await waitFor(() =>
      expect(h.exploreOpen).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: 'notes.txt',
        reveal: true,
      }),
    );
  });

  it('shows size and age in the title attribute instead of a permanent meta row', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    render(<ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    const row = screen.getByText('notes.txt').closest('[title]');
    expect(row?.getAttribute('title')).toMatch(/^20 B ·/);
  });
});
