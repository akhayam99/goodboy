// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  state,
  onClose,
  onStarted,
  slotsBySession,
  slotsLoadBySession,
  ensureSlotsSpy,
  writeAttachmentSpy,
  readAttachmentSpy,
  deleteAttachmentSpy,
} = vi.hoisted(() => {
  const slotsBySession: Record<string, ReadonlyArray<Record<string, unknown>>> = {};
  const slotsLoadBySession: Record<string, string | null> = {};
  const ensureSlotsSpy = vi.fn(
    async (sessionId: string): Promise<ReadonlyArray<Record<string, unknown>>> =>
      slotsBySession[sessionId] ?? [],
  );
  return {
    slotsBySession,
    slotsLoadBySession,
    ensureSlotsSpy,
    writeAttachmentSpy: vi.fn(async () => '.goodboy/attachments/att-1-inbox.png'),
    readAttachmentSpy: vi.fn(async () => 'data:image/png;base64,aGk='),
    deleteAttachmentSpy: vi.fn(async () => undefined),
    onClose: vi.fn(),
    onStarted: vi.fn(),
    state: {
      ensureSessionSlots: ensureSlotsSpy,
      artifactDrafts: {} as Record<string, Record<string, unknown>>,
      sessions: [] as ReadonlyArray<Record<string, unknown>>,
      sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
      sessionArtifacts: {} as Record<string, ReadonlyArray<unknown>>,
      sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
      scriptRuns: {} as Record<string, Record<string, unknown>>,
      transcripts: {} as Record<string, ReadonlyArray<unknown>>,
      summarizerStatus: {} as Record<string, { readonly status: string }>,
      agentTurnState: {} as Record<string, { readonly kind: string }>,
      providers: [{ id: 'anthropic', connection: 'connected' }] as ReadonlyArray<
        Record<string, unknown>
      >,
      providerCooldowns: {},
      budgetAlerts: [] as ReadonlyArray<unknown>,
      workspaceOverrides: {},
      sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
      sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
      sessionActiveMount: {},
      sessionActiveProject: {},
      phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
      sessionWorkflows: {} as Record<string, ReadonlyArray<unknown>>,
      sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
      setArtifactDraft: vi.fn(),
      clearArtifactDraft: vi.fn(),
      setArtifactFilter: vi.fn(),
      spawnReportAgent: vi.fn(async () => 'agent-report'),
      spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
    },
  };
});

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  useAppStore.getState = () => state;
  return {
    EMPTY_ARRAY: [] as readonly never[],
    useAppStore,
    useSessionSlots: (sessionId: string) => slotsBySession[sessionId] ?? [],
    useSessionSlotsLoad: (sessionId: string) => slotsLoadBySession[sessionId] ?? null,
  };
});

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async () => () => undefined,
  }),
}));

vi.mock('../../../chat/turn', () => ({
  writeAttachment: writeAttachmentSpy,
  readAttachment: readAttachmentSpy,
  deleteAttachment: deleteAttachmentSpy,
}));

vi.mock('../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({ model }: { readonly model: string }) => (
    <div data-testid="routing-picker">{model}</div>
  ),
}));

import { ArtifactCreationPane } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));
const WORKTREE = '/tmp/harborline-worktree';
const RUN_ID = JSON.parse(JSON.stringify('run-ledger-1'));
const WORKSPACE_ID = JSON.parse(JSON.stringify('workspace-harborline'));

const session = (runs: ReadonlyArray<Record<string, unknown>> = []) =>
  JSON.parse(
    JSON.stringify({
      id: SESSION_ID,
      workspaceId: WORKSPACE_ID,
      goal: 'Fix the rounding drift in ledger-core postings',
      workflowRuns: runs,
    }),
  );

const finishedAgent = (overrides: Record<string, unknown> = {}) => ({
  id: 'agent-implementer',
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Apply the rounding fix',
  status: 'completed',
  ...overrides,
});

const renderPane = ({
  kind = 'report',
  runs = [],
  note = null,
}: {
  readonly kind?: 'report' | 'wireframe';
  readonly runs?: ReadonlyArray<Record<string, unknown>>;
  readonly note?: string | null;
} = {}) =>
  render(
    <ArtifactCreationPane
      sessionId={SESSION_ID}
      session={session(runs)}
      kind={kind}
      note={note}
      count={3}
      onClose={onClose}
      onStarted={onStarted}
    />,
  );

const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  state.artifactDrafts = {};
  state.sessions = [session()];
  state.sessionPhaseRuns = { [SESSION_ID]: [finishedAgent()] };
  state.sessionArtifacts = {};
  state.sessionEvents = {};
  state.scriptRuns = {};
  state.transcripts = {};
  state.summarizerStatus = {};
  state.agentTurnState = {};
  state.providers = [{ id: 'anthropic', connection: 'connected' }];
  state.sessionMounts = {};
  state.sessionProjectMounts = {};
  state.phaseTemplates = {};
  state.sessionWorkflows = {};
  state.sessionWorktrees = { [SESSION_ID]: [WORKTREE] };
  slotsBySession[SESSION_ID] = [];
  slotsLoadBySession[SESSION_ID] = 'loaded';
  ensureSlotsSpy.mockImplementation(async (sessionId: string) => slotsBySession[sessionId] ?? []);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ArtifactCreationPane', () => {
  it('opens with the report defaults and no agent spawned', () => {
    renderPane();
    expect(screen.getByTestId('artifact-creation-pane')).toBeTruthy();
    expect(
      screen.getByRole('option', { name: /Session summary/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(state.spawnReportAgent).not.toHaveBeenCalled();
  });

  it('shows the default request under an empty brief and hides it once typed', () => {
    renderPane();
    expect(screen.getByText(/with no brief the agent is asked to/)).toBeTruthy();
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'the rounding' } });
    expect(screen.queryByText(/with no brief the agent is asked to/)).toBeNull();
  });

  it('inserts the session goal without overwriting what was typed', () => {
    renderPane();
    const brief = screen.getByTestId('artifact-brief');
    fireEvent.change(brief, { target: { value: 'focus on the settled batches' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use the session goal' }));
    expect((brief as HTMLTextAreaElement).value).toBe(
      'focus on the settled batches\n\nFix the rounding drift in ledger-core postings',
    );
  });

  it('asks for the slots on mount and will not insert before the read answers', async () => {
    const longGoal = [
      'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
      'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
    ].join('\n\n');
    slotsLoadBySession[SESSION_ID] = null;
    let release: () => void = () => undefined;
    ensureSlotsSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(slotsBySession[SESSION_ID] ?? []);
        }),
    );

    const view = renderPane();
    expect(ensureSlotsSpy).toHaveBeenCalledWith(SESSION_ID);

    const pending = screen.getByRole('button', { name: 'Use the session goal' });
    expect(pending.hasAttribute('disabled')).toBe(true);
    expect(pending.getAttribute('title')).toBe('the session goal is still loading');
    fireEvent.click(pending);
    expect((screen.getByTestId('artifact-brief') as HTMLTextAreaElement).value).toBe('');

    slotsBySession[SESSION_ID] = [{ key: 'goal', value: longGoal, enabled: true }];
    slotsLoadBySession[SESSION_ID] = 'loaded';
    await act(async () => {
      release();
    });
    view.rerender(
      <ArtifactCreationPane
        sessionId={SESSION_ID}
        session={session()}
        kind="report"
        note={null}
        count={3}
        onClose={onClose}
        onStarted={onStarted}
      />,
    );

    const ready = screen.getByRole('button', { name: 'Use the session goal' });
    expect(ready.hasAttribute('disabled')).toBe(false);
    fireEvent.click(ready);
    expect((screen.getByTestId('artifact-brief') as HTMLTextAreaElement).value).toBe(longGoal);
  });

  it('inserts the goal the user wrote, not the clamped title', () => {
    const longGoal = [
      'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
      'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
    ].join('\n\n');
    slotsBySession[SESSION_ID] = [{ key: 'goal', value: longGoal, enabled: true }];
    renderPane();
    const brief = screen.getByTestId('artifact-brief');
    fireEvent.click(screen.getByRole('button', { name: 'Use the session goal' }));
    expect((brief as HTMLTextAreaElement).value).toBe(longGoal);
  });

  it('inserts the title when the user disabled the goal slot', () => {
    slotsBySession[SESSION_ID] = [
      { key: 'goal', value: 'a much longer goal nobody asked to send', enabled: false },
    ];
    renderPane();
    const brief = screen.getByTestId('artifact-brief');
    fireEvent.click(screen.getByRole('button', { name: 'Use the session goal' }));
    expect((brief as HTMLTextAreaElement).value).toBe(
      'Fix the rounding drift in ledger-core postings',
    );
  });

  it('keeps the hint under the selected choice only', () => {
    renderPane();
    const hintOf = (name: RegExp): string => screen.getByRole('option', { name }).textContent ?? '';
    expect(hintOf(/Session summary/)).toContain('what the session set out to do');
    expect(hintOf(/Local change report/)).not.toContain('as a reviewer reads it');
    fireEvent.click(screen.getByRole('option', { name: /Local change report/ }));
    expect(hintOf(/Local change report/)).toContain('as a reviewer reads it');
    expect(hintOf(/Session summary/)).not.toContain('what the session set out to do');
  });

  it('prefills based on with the run it was opened from', () => {
    state.artifactDrafts = {
      [SESSION_ID]: {
        report: {
          kind: 'report',
          reportType: 'session-summary',
          brief: '',
          attachments: [],
          mountIds: [],
          basedOn: { kind: 'workflow-run', workflowRunId: RUN_ID },
          routing: null,
          updatedAt: '2026-09-16T10:00:00.000Z',
        },
      },
    };
    state.phaseTemplates = { [WORKSPACE_ID]: [{ id: 'wf-1', name: 'Ship it', steps: [] }] };
    renderPane({ runs: [{ id: RUN_ID, workflowId: 'wf-1', ordinal: 0 }] });
    expect((screen.getByTestId('artifact-based-on') as HTMLSelectElement).value).toBe(RUN_ID);
  });

  it('falls back to the session when the drafted run was discarded', () => {
    state.artifactDrafts = {
      [SESSION_ID]: {
        report: {
          kind: 'report',
          reportType: 'session-summary',
          brief: '',
          attachments: [],
          mountIds: [],
          basedOn: { kind: 'workflow-run', workflowRunId: RUN_ID },
          routing: null,
          updatedAt: '2026-09-16T10:00:00.000Z',
        },
      },
    };
    renderPane({ runs: [] });
    expect((screen.getByTestId('artifact-based-on') as HTMLSelectElement).value).toBe('');
  });

  it('says the run scope leaves events, checks and the local change session wide', () => {
    state.phaseTemplates = { [WORKSPACE_ID]: [{ id: 'wf-1', name: 'Ship it', steps: [] }] };
    renderPane({ runs: [{ id: RUN_ID, workflowId: 'wf-1', ordinal: 0 }] });
    fireEvent.change(screen.getByTestId('artifact-based-on'), { target: { value: RUN_ID } });
    expect(
      screen.getByText(
        'agents and artifacts come from this run. session events, checks and the local change are session wide either way.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('no mounted project, so no local change evidence.')).toBeTruthy();
  });

  it('lists what the pack carries and what it cuts short', async () => {
    renderPane();
    await settle();
    fireEvent.click(screen.getByText('Included context'));
    const labels = screen.getAllByTestId('artifact-context-row').map((row) => row.textContent);
    expect(labels.some((text) => text?.startsWith('brief'))).toBe(true);
    expect(labels.some((text) => text?.includes('no mounted project'))).toBe(true);
    expect(labels.some((text) => text?.includes('tool calls, tool output, transcripts'))).toBe(
      true,
    );
  });

  it('generates a report with the brief and the picked run', async () => {
    state.phaseTemplates = { [WORKSPACE_ID]: [{ id: 'wf-1', name: 'Ship it', steps: [] }] };
    state.sessionPhaseRuns = {
      [SESSION_ID]: [finishedAgent({ workflowRunId: RUN_ID })],
    };
    renderPane({ runs: [{ id: RUN_ID, workflowId: 'wf-1', ordinal: 0 }] });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'call out the residual convention' },
    });
    fireEvent.change(screen.getByTestId('artifact-based-on'), { target: { value: RUN_ID } });
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnReportAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        reportType: 'session-summary',
        workflowRunId: RUN_ID,
        routing: null,
        brief: 'call out the residual convention',
        attachments: [],
        mountIds: [],
        focus: 'none',
      });
    });
  });

  it('generates a wireframe on a brief alone when nothing has run', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    renderPane({ kind: 'wireframe' });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'the settlement review flow' },
    });
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        fidelity: 'low',
        target: 'both',
        workflowRunId: null,
        routing: null,
        brief: 'the settlement review flow',
        attachments: [],
        mountIds: [],
        focus: 'none',
      });
    });
  });

  it('refuses a report when nothing has run and says what is missing', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    renderPane();
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'anything' } });
    expect(screen.getByTestId('artifact-generate').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/run an agent or a workflow first/)).toBeTruthy();
  });

  it('refuses a wireframe with no brief when nothing has run', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    renderPane({ kind: 'wireframe' });
    expect(screen.getByTestId('artifact-generate').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/describe the screen or flow/)).toBeTruthy();
  });

  it('stays blocked while the run is still going', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [finishedAgent({ status: 'running' })] };
    renderPane();
    expect(screen.getByTestId('artifact-generate').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('the run is still going, finish it first')).toBeTruthy();
  });

  it('disables generate when no provider is usable', () => {
    state.providers = [];
    renderPane();
    expect(screen.getByTestId('artifact-generate').hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('connect a provider to generate')).toBeTruthy();
  });

  it('keeps the draft on back and clears it on a confirmed cancel', () => {
    renderPane();
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'keep me' } });
    state.clearArtifactDraft.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'All artifacts' }));
    expect(onClose).toHaveBeenCalled();
    expect(state.clearArtifactDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(state.clearArtifactDraft).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'report',
    });
  });

  it('stays on the collection after generate instead of revealing the chat', async () => {
    const dispatched: Array<string> = [];
    const listener = (event: Event) => dispatched.push(event.type);
    window.addEventListener('goodboy:reveal-chat', listener);
    renderPane();
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith('agent-report');
    });
    expect(dispatched).toEqual([]);
    expect(state.setArtifactFilter).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      filter: 'report',
    });
    window.removeEventListener('goodboy:reveal-chat', listener);
  });

  it('shows the spawn failure inline and keeps the brief', async () => {
    state.spawnReportAgent.mockRejectedValueOnce(new Error('no provider connected'));
    renderPane();
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'keep this' } });
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no provider connected');
    });
    expect((screen.getByTestId('artifact-brief') as HTMLTextAreaElement).value).toBe('keep this');
  });

  it('generates on cmd enter from the brief', async () => {
    renderPane();
    fireEvent.keyDown(screen.getByTestId('artifact-brief'), { key: 'Enter', metaKey: true });
    await waitFor(() => {
      expect(state.spawnReportAgent).toHaveBeenCalled();
    });
  });

  it('shows the note when a retried generation recorded no brief', () => {
    renderPane({ note: 'the brief of this generation was not recorded' });
    expect(screen.getByTestId('artifact-creation-note').textContent).toBe(
      'the brief of this generation was not recorded',
    );
  });

  it('hides the counter until the brief nears the bound and warns at it', () => {
    renderPane();
    const brief = screen.getByTestId('artifact-brief');
    expect(screen.queryByTestId('artifact-brief-counter')).toBeNull();
    fireEvent.change(brief, { target: { value: 'x'.repeat(1_700) } });
    expect(screen.getByTestId('artifact-brief-counter').textContent).toBe('1,700 / 2,000');
    fireEvent.change(brief, { target: { value: 'x'.repeat(2_000) } });
    expect(screen.getByTestId('artifact-brief-counter').textContent).toBe(
      '2,000 / 2,000, at the limit',
    );
  });

  it('says when a paste was cut at the bound and clears the note on the next edit', () => {
    renderPane();
    const brief = screen.getByTestId('artifact-brief');
    fireEvent.change(brief, { target: { value: 'x'.repeat(1_990) } });
    fireEvent.paste(brief, {
      clipboardData: { getData: () => 'y'.repeat(100) },
    });
    expect(screen.getByRole('status').textContent).toBe('pasted text was cut at 2,000 characters');
    fireEvent.change(brief, { target: { value: 'x'.repeat(1_991) } });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['report', 'wireframe'] as const)(
    'stores an attached screen and sends its path with the %s',
    async (kind) => {
      state.sessionPhaseRuns = { [SESSION_ID]: [finishedAgent()] };
      renderPane({ kind });
      fireEvent.change(screen.getByTestId('artifact-brief'), {
        target: { value: 'match this layout' },
      });
      await act(async () => {
        fireEvent.change(screen.getByTestId('artifact-attachments-input'), {
          target: { files: [new File(['bytes'], 'inbox.png', { type: 'image/png' })] },
        });
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(writeAttachmentSpy).toHaveBeenCalledWith({
          worktreeDir: WORKTREE,
          attachmentId: expect.any(String),
          fileName: 'inbox.png',
          dataBase64: expect.any(String),
        });
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove inbox.png' })).toBeTruthy();
      });
      fireEvent.click(screen.getByTestId('artifact-generate'));
      const spawn = kind === 'report' ? state.spawnReportAgent : state.spawnWireframeAgent;
      await waitFor(() => {
        expect(spawn).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: [
              expect.objectContaining({
                fileName: 'inbox.png',
                mimeType: 'image/png',
                relPath: '.goodboy/attachments/att-1-inbox.png',
              }),
            ],
          }),
        );
      });
    },
  );

  it('drops the chip and the file on disk when the draft is discarded', async () => {
    renderPane();
    await act(async () => {
      fireEvent.change(screen.getByTestId('artifact-attachments-input'), {
        target: { files: [new File(['bytes'], 'inbox.png', { type: 'image/png' })] },
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove inbox.png' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => {
      expect(deleteAttachmentSpy).toHaveBeenCalledWith(
        WORKTREE,
        '.goodboy/attachments/att-1-inbox.png',
      );
    });
  });

  it('says nothing can be attached while the session has no worktree', () => {
    state.sessionWorktrees = {};
    renderPane();
    expect(screen.getByText(/no worktree yet/)).toBeTruthy();
  });

  it('asks a wireframe what it is drawn for, and offers no target on a report', () => {
    renderPane({ kind: 'wireframe' });
    expect(screen.getByRole('listbox', { name: 'Target' })).toBeTruthy();
    expect(
      screen.getByRole('option', { name: /Phone and desktop/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('option', { name: /^Desktop/ })).toBeTruthy();
    cleanup();
    renderPane();
    expect(screen.queryByRole('listbox', { name: 'Target' })).toBeNull();
  });

  it('sends the target the user picked to the wireframe agent', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    renderPane({ kind: 'wireframe' });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'the operator console' },
    });
    fireEvent.click(screen.getByRole('option', { name: /^Desktop/ }));
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        fidelity: 'low',
        target: 'desktop',
        workflowRunId: null,
        routing: null,
        brief: 'the operator console',
        attachments: [],
        mountIds: [],
        focus: 'none',
      });
    });
  });

  const mountRow = ({
    mountId,
    mountName,
    branch,
  }: {
    readonly mountId: string;
    readonly mountName: string;
    readonly branch: string;
  }) => ({
    mountId,
    sessionId: SESSION_ID,
    projectId: 'project-1',
    mountName,
    worktreePath: `/tmp/${mountId}`,
    lastWorktreePath: null,
    repoRoot: `/repo/${mountId}`,
    branch,
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  });

  const WEB = mountRow({ mountId: 'mount-web', mountName: 'web', branch: 'ak/feat-web' });
  const API = mountRow({ mountId: 'mount-api', mountName: 'api', branch: 'ak/feat-api' });

  it('renders no read from row when nothing is mounted', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    renderPane({ kind: 'wireframe' });
    expect(screen.queryByTestId('artifact-mount-rows')).toBeNull();
  });

  it('shows the sole mount and its branch, already chosen', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    state.sessionProjectMounts = { [SESSION_ID]: [WEB] };
    renderPane({ kind: 'wireframe' });
    const chip = screen.getByRole('option', { name: /web/ });
    expect(chip.getAttribute('aria-selected')).toBe('true');
    expect(chip.textContent).toContain('ak/feat-web');
  });

  it('preselects every mount when two are attached and none is selected', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    state.sessionProjectMounts = { [SESSION_ID]: [WEB, API] };
    renderPane({ kind: 'wireframe' });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'the settlement review flow' },
    });
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ mountIds: ['mount-web', 'mount-api'] }),
      );
    });
  });

  it('sends only the mount the user left selected', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    state.sessionProjectMounts = { [SESSION_ID]: [WEB, API] };
    renderPane({ kind: 'wireframe' });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'the settlement review flow' },
    });
    fireEvent.click(screen.getByRole('option', { name: /api/ }));
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ mountIds: ['mount-web'] }),
      );
    });
  });

  it('honours the selected mount over the rest when one is selected', async () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    state.sessionProjectMounts = { [SESSION_ID]: [WEB, API] };
    state.sessionActiveMount = { [SESSION_ID]: 'mount-api' };
    renderPane({ kind: 'wireframe' });
    fireEvent.change(screen.getByTestId('artifact-brief'), {
      target: { value: 'the settlement review flow' },
    });
    fireEvent.click(screen.getByTestId('artifact-generate'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith(
        expect.objectContaining({ mountIds: ['mount-api'] }),
      );
    });
  });
});
