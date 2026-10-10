// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderId, Session, SessionId } from '@goodboy/types';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

type Store = {
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly navigate: ReturnType<typeof vi.fn>;
  readonly loadAgentTranscript: ReturnType<typeof vi.fn>;
  readonly providers: ReadonlyArray<{
    readonly id: ProviderId;
    readonly connection: string;
  }>;
  readonly cliRequirements: ReadonlyArray<never>;
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
  navigate: vi.fn(),
  loadAgentTranscript: vi.fn(async () => undefined),
  resetStore: (): void => undefined,
  patchStore: (_patch: Record<string, unknown>): void => undefined,
  loadDetectedEditors: vi.fn(async () => undefined),
  showToast:
    vi.fn<(params: { readonly kind: string; readonly message: string } & ToastOptions) => void>(),
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

vi.mock('../../../../store', async () => {
  const { create } = await vi.importActual<typeof import('zustand')>('zustand');
  const { createDrawerSlice } = await vi.importActual<
    typeof import('../../../../store/slices/drawer')
  >('../../../../store/slices/drawer');
  const store = create<Record<string, unknown>>()((set, get) => ({
    spawnAgent: h.spawnAgent,
    navigate: h.navigate,
    get providers() {
      return h.providers;
    },
    cliRequirements: [],
    sessions: h.sessions,
    workspaceOverrides: {},
    currentWorkspaceId: null,
    currentSessionId: 'session-1',
    openSessionDraftWorkspaceId: null,
    appStudio: null,
    activeLens: { 'session-1': 'explore' },
    sessionStudio: {},
    selectedAgentId: {},
    sessionPhaseRuns: {},
    agentKindOverride: {},
    drawer: null,
    settings: {},
    projects: [],
    sessionProjectMounts: {},
    sessionActiveMount: {},
    detectedEditors: [],
    loadDetectedEditors: h.loadDetectedEditors,
    ...createDrawerSlice({ set: set as never, get: get as never }),
  }));
  h.resetStore = () =>
    store.setState({
      drawer: null,
      settings: {},
      projects: [],
      sessionProjectMounts: {},
      sessionActiveMount: {},
      detectedEditors: [],
    });
  h.patchStore = (patch) => store.setState(patch);
  return {
    ...(await import('../../../../store/slices/navigation/place')),
    useAppStore: Object.assign(
      <T,>(selector: (state: Store) => T) => store((state) => selector(state as unknown as Store)),
      { getState: store.getState },
    ),
  };
});

vi.mock('../../../../shared/components/Toast', () => ({
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

import { CommandError } from '../../../../shared/lib/invokeCommand';
import { ExplorePane } from '.';
import { ExploreFileDrawer } from '../ExploreFileDrawer';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';

const SESSION_ID = 'session-1' as SessionId;

const PaneWithDrawer = () => {
  const drawer = useAppStore((state) => selectOpenDrawer(state as never));
  const closeDrawer = useAppStore(
    (state) => (state as never as { closeDrawer: () => void }).closeDrawer,
  );
  return (
    <>
      <ExplorePane sessionId={SESSION_ID} sessionDir="/workspace/sessions/session-1" />
      {drawer !== null && drawer.kind === 'explore-file' ? (
        <ExploreFileDrawer
          sessionId={SESSION_ID}
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          onClose={closeDrawer}
        />
      ) : null}
    </>
  );
};

beforeEach(() => {
  h.exploreList.mockReset();
  h.exploreList.mockResolvedValue([]);
  h.exploreOpen.mockReset();
  h.exploreOpen.mockResolvedValue(undefined);
  h.exploreRead.mockReset();
  h.spawnAgent.mockReset();
  h.spawnAgent.mockResolvedValue('agent-1');
  h.navigate.mockClear();
  h.showToast.mockClear();
  h.providers = [{ id: 'anthropic' as ProviderId, connection: 'connected' }];
  h.loadDetectedEditors.mockClear();
  h.resetStore();
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

    render(<PaneWithDrawer />);

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

    render(<PaneWithDrawer />);

    await waitFor(() =>
      expect(screen.getByText("Couldn't read this session folder")).toBeDefined(),
    );
    expect(screen.getByText('io error: permission denied')).toBeDefined();
    expect(screen.queryByText('No new files')).toBeNull();
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

    render(<PaneWithDrawer />);

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
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(h.exploreOpen).toHaveBeenCalledWith({
        sessionDir: '/workspace/sessions/session-1',
        relPath: 'budget.xlsx',
        reveal: false,
        editor: null,
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

    render(<PaneWithDrawer />);

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

    render(<PaneWithDrawer />);

    await waitFor(() => expect(screen.getByText('budget.xlsx')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about budget.xlsx' }));

    fireEvent.change(
      screen.getByRole('textbox', { name: 'What should the agent do with this file?' }),
      {
        target: { value: 'Analyze this spreadsheet and summarize trends.' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Agent routing:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));

    await waitFor(() => expect(h.spawnAgent).toHaveBeenCalled());
    const spawnArgs = h.spawnAgent.mock.calls.at(-1)?.[1] as
      | { readonly model: string; readonly initialPrompt: string; readonly focus: string }
      | undefined;
    expect(spawnArgs?.focus).toBe('none');
    expect(spawnArgs?.model).toBe('claude-opus-5-5');
    expect(spawnArgs?.initialPrompt).toContain('Analyze this spreadsheet and summarize trends.');
    expect(spawnArgs?.initialPrompt).toContain('- budget.xlsx');
    expect(
      (spawnArgs?.initialPrompt.indexOf('Analyze this spreadsheet and summarize trends.') ?? 0) <
        (spawnArgs?.initialPrompt.indexOf('- budget.xlsx') ?? 0),
    ).toBe(true);
    expect(h.navigate).not.toHaveBeenCalled();

    expect(h.showToast.mock.calls[0]![0]?.kind).toBe('info');
    const action = h.showToast.mock.calls[0]![0]?.action;
    expect(action?.label).toBe('Follow');
    action?.onClick();

    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith({
        to: { at: 'agent', sessionId: SESSION_ID, agentId: 'agent-1' },
      }),
    );
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

    render(<PaneWithDrawer />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about notes.txt' }));
    expect(screen.getByRole('button', { name: 'Start agent' }).hasAttribute('disabled')).toBe(true);
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

    render(<PaneWithDrawer />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    const revealButton = screen.getByRole('button', {
      name: 'Show notes.txt in Finder',
    });
    const actionsWrapper = revealButton.closest('div');
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
        editor: null,
      }),
    );
  });

  it('puts size and age in the title of the name, and no title on the row or its buttons', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);

    const { container } = render(<PaneWithDrawer />);

    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    const name = screen.getByText('notes.txt');
    expect(name.getAttribute('title')).toMatch(/^20 B ·/);
    const titled = Array.from(container.querySelectorAll('[title]'));
    expect(titled).toEqual([name]);
  });

  it('names each row action on hover, one tooltip at a time', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    render(<PaneWithDrawer />);
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());

    const expected = [
      { name: 'Ask an agent about notes.txt', tip: 'Ask an agent' },
      { name: 'Open notes.txt', tip: 'Open' },
      { name: 'Show notes.txt in Finder', tip: 'Show in Finder' },
    ];
    for (const { name, tip } of expected) {
      const button = screen.getByRole('button', { name });
      fireEvent.mouseEnter(button);
      expect((await screen.findByRole('tooltip')).textContent).toBe(tip);
      fireEvent.mouseLeave(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    }
  });

  it('shows no tooltip over the ask button while its popover is open', async () => {
    h.exploreList.mockResolvedValueOnce([
      {
        name: 'notes.txt',
        relPath: 'notes.txt',
        isDir: false,
        sizeBytes: 20,
        modifiedAt: '2026-07-21T11:00:00Z',
      },
    ]);
    render(<PaneWithDrawer />);
    await waitFor(() => expect(screen.getByText('notes.txt')).toBeDefined());
    const ask = screen.getByRole('button', { name: 'Ask an agent about notes.txt' });

    fireEvent.click(ask);
    fireEvent.mouseEnter(ask);
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.getByRole('dialog', { name: 'Ask an agent about notes.txt' })).toBeDefined();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  describe('in a repository with an editor', () => {
    const mountRepo = () => {
      h.patchStore({
        projects: [{ id: 'project-1', kind: 'repo' }],
        sessionProjectMounts: {
          'session-1': [
            {
              mountId: 'mount-1',
              sessionId: 'session-1',
              projectId: 'project-1',
              mountName: 'ledger-core',
              worktreePath: '/workspace/sessions/session-1',
              lastWorktreePath: null,
              repoRoot: '/workspace/ledger-core',
              branch: 'ak/fix-retry',
              baseBranch: 'main',
              parallelIndex: 0,
              isAttached: true,
              diskState: 'present',
              revision: 1,
            },
          ],
        },
        sessionActiveMount: { 'session-1': 'mount-1' },
        detectedEditors: [{ binary: 'code', label: 'VS Code' }],
      });
    };

    const listPage = (name: string) =>
      h.exploreList.mockResolvedValueOnce([
        { name, relPath: name, isDir: false, sizeBytes: 20, modifiedAt: '2026-07-21T11:00:00Z' },
      ]);

    it('offers Open in editor for code and opens it in that editor', async () => {
      mountRepo();
      listPage('page.tsx');
      render(<PaneWithDrawer />);
      await waitFor(() => expect(screen.getByText('page.tsx')).toBeDefined());

      const open = screen.getByRole('button', { name: 'Open page.tsx in VS Code' });
      fireEvent.mouseEnter(open);
      expect((await screen.findByRole('tooltip')).textContent).toBe('Open in editor');
      fireEvent.click(open);

      await waitFor(() =>
        expect(h.exploreOpen).toHaveBeenCalledWith({
          sessionDir: '/workspace/sessions/session-1',
          relPath: 'page.tsx',
          reveal: false,
          editor: 'code',
        }),
      );
    });

    it('labels the drawer button the same way and names the editor on hover', async () => {
      mountRepo();
      listPage('page.tsx');
      h.exploreRead.mockResolvedValueOnce({ type: 'text', text: 'export {}', truncated: false });
      render(<PaneWithDrawer />);
      await waitFor(() => expect(screen.getByText('page.tsx')).toBeDefined());

      fireEvent.click(screen.getByRole('button', { name: 'Preview page.tsx' }));
      const open = await screen.findByRole('button', { name: 'Open in editor' });
      fireEvent.mouseEnter(open);
      expect((await screen.findByText('Open in VS Code')).getAttribute('role')).toBe('tooltip');
      fireEvent.click(open);

      await waitFor(() =>
        expect(h.exploreOpen).toHaveBeenCalledWith({
          sessionDir: '/workspace/sessions/session-1',
          relPath: 'page.tsx',
          reveal: false,
          editor: 'code',
        }),
      );
    });

    it('keeps the default app for a PDF in a repository', async () => {
      mountRepo();
      listPage('spec.pdf');
      render(<PaneWithDrawer />);
      await waitFor(() => expect(screen.getByText('spec.pdf')).toBeDefined());

      fireEvent.click(screen.getByRole('button', { name: 'Open spec.pdf' }));

      await waitFor(() =>
        expect(h.exploreOpen).toHaveBeenCalledWith({
          sessionDir: '/workspace/sessions/session-1',
          relPath: 'spec.pdf',
          reveal: false,
          editor: null,
        }),
      );
    });

    it('says the editor is missing and offers to choose another', async () => {
      mountRepo();
      listPage('page.tsx');
      h.exploreOpen.mockRejectedValueOnce(
        new CommandError({
          kind: 'editor_missing',
          message: "editor binary 'code' not found in PATH",
        }),
      );
      render(<PaneWithDrawer />);
      await waitFor(() => expect(screen.getByText('page.tsx')).toBeDefined());

      fireEvent.click(screen.getByRole('button', { name: 'Open page.tsx in VS Code' }));

      await waitFor(() =>
        expect(screen.getByText(/^Couldn't open page.tsx in VS Code\./)).toBeDefined(),
      );
      expect(screen.getByRole('button', { name: 'Choose editor' })).toBeDefined();
    });

    it('names the file and leaves out the editor link for any other failure', async () => {
      mountRepo();
      listPage('page.tsx');
      h.exploreOpen.mockRejectedValueOnce(new Error('permission denied'));
      render(<PaneWithDrawer />);
      await waitFor(() => expect(screen.getByText('page.tsx')).toBeDefined());

      fireEvent.click(screen.getByRole('button', { name: 'Open page.tsx in VS Code' }));

      await waitFor(() =>
        expect(
          screen.getByText("Couldn't open page.tsx in VS Code. permission denied"),
        ).toBeDefined(),
      );
      expect(screen.queryByRole('button', { name: 'Choose editor' })).toBeNull();
    });
  });

  it('loads the detected editors when none are known yet', async () => {
    render(<PaneWithDrawer />);

    await waitFor(() => expect(h.loadDetectedEditors).toHaveBeenCalled());
  });
});
