// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const experiment = vi.hoisted(() => ({ isOn: false }));

vi.mock('../../../auto/useIsAutoOn', () => ({
  useIsAutoOn: () => experiment.isOn,
}));

vi.mock('../../../auto/useConfirmStartMode', () => ({
  useConfirmStartMode:
    () =>
    async ({ isShown }: { readonly isShown: boolean }) =>
      experiment.isOn === isShown,
}));

vi.mock('../../../auto/useAutoTreeLimit', () => ({
  useAutoTreeLimit: () => ({
    usd: 5,
    isFromSession: false,
    isStored: true,
    change: () => undefined,
    persist: async () => undefined,
  }),
}));

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../history/testing/brandedId';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type {
  AgentId,
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { anAgent, aWorkflowRun } from '@goodboy/types/testing';
import { WritePanel } from '../../../artifacts/components/WritePanel';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { NewDrawerPayload } from '../../../../store/slices/drawer/state';
import { readLastNewTab } from '../../newDrawerTab';

let useAppStore: StoryStore;
let NewDrawer: typeof import('./index').NewDrawer;

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-harborline' });
const STAMP = brandedId<IsoDateTime>({ value: '2026-10-14T09:00:00.000Z' });

const HARBORLINE = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const SESSION: Session = buildStorySession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Retry payments through ledger-core',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
});

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

const spawnAgent = vi.fn<AppStore['spawnAgent']>();

beforeAll(async () => {
  useAppStore = await importStore();
  ({ NewDrawer } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  experiment.isOn = false;
  spawnAgent.mockReset();
  spawnAgent.mockResolvedValue(brandedId<AgentId>({ value: 'agent-1' }));
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    providers: [connected('anthropic')],
    phaseTemplates: { [WORKSPACE_ID]: [] },
    spawnAgent,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type OpenParams = {
  readonly payload?: NewDrawerPayload | null;
  readonly onClose?: () => void;
};

const openDrawer = ({ payload = null, onClose = vi.fn() }: OpenParams = {}) =>
  render(
    <ToastProvider>
      <NewDrawer
        sessionId={SESSION_ID}
        payload={payload}
        writePanel={WritePanel}
        onClose={onClose}
      />
    </ToastProvider>,
  );

const tab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'What to start' })).getByRole('tab', { name });

const isSelected = (name: string) => tab(name).getAttribute('aria-selected') === 'true';

const textAreaOf = (element: HTMLElement): HTMLTextAreaElement => {
  if (!(element instanceof HTMLTextAreaElement)) {
    throw new Error('Expected a text area');
  }
  return element;
};

const buttonOf = (element: HTMLElement): HTMLButtonElement => {
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error('Expected a button');
  }
  return element;
};

const elementOf = (element: Element | null): HTMLElement => {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected an element');
  }
  return element;
};

const goalBox = () => textAreaOf(screen.getByRole('textbox', { name: 'Goal' }));

describe('NewDrawer (shell)', () => {
  it('opens on Run, names the three tabs and says what Run does on one line', () => {
    openDrawer();

    expect(screen.getByRole('region', { name: 'New' })).toBeDefined();
    expect(['Run', 'Agent', 'Write'].map(isSelected)).toEqual([true, false, false]);
    expect(screen.getByText('Several agents work through your goal, step by step.')).toBeDefined();
  });

  it('draws only Discard draft and the close button in the header, with no chord label', () => {
    openDrawer();
    const header = elementOf(document.querySelector('[data-drawer-header]'));

    expect(within(header).queryByText(/⌘/)).toBeNull();
    expect(within(header).queryByRole('button', { name: /discard draft/i })).toBeNull();
    fireEvent.change(goalBox(), { target: { value: 'Stop retried webhooks' } });
    expect(within(header).getByRole('button', { name: /discard draft/i })).toBeDefined();
    expect(within(header).getByRole('button', { name: 'Close' })).toBeDefined();
  });

  it('remembers the last tab per workspace', () => {
    const first = openDrawer();
    fireEvent.click(tab('Agent'));
    expect(readLastNewTab({ workspaceId: WORKSPACE_ID })).toBe('agent');
    first.unmount();

    openDrawer();
    expect(isSelected('Agent')).toBe(true);
  });

  it('opens on the tab an entry asks for, and follows a later entry while open', () => {
    const view = openDrawer({ payload: { tab: 'write', writeKind: 'wireframe' } });
    expect(isSelected('Write')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Wireframe' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    view.rerender(
      <ToastProvider>
        <NewDrawer
          sessionId={SESSION_ID}
          payload={{ tab: 'run' }}
          writePanel={WritePanel}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(isSelected('Run')).toBe(true);
  });

  it('closes on Escape, the way every drawer does', () => {
    const onClose = vi.fn();
    openDrawer({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('points Open active run at the Runs lens while a run is in progress', () => {
    const run = aWorkflowRun();
    const live: Session = { ...SESSION, workflowRuns: [run] };
    useAppStore.setState({
      sessions: [live],
      sessionPhaseRuns: {
        [SESSION_ID]: [
          anAgent({ sessionId: SESSION_ID, workflowRunId: run.id, status: 'running' }),
        ],
      },
    });
    const onClose = vi.fn();
    openDrawer({ onClose });

    fireEvent.click(screen.getByRole('button', { name: /open active run/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('workflows');
  });

  it('has no Open active run when nothing is running', () => {
    openDrawer();

    expect(screen.queryByRole('button', { name: /open active run/i })).toBeNull();
  });
});

describe('NewDrawer (Run)', () => {
  it('shows the goal first, then the lane, then the three pills and Start run in the footer', () => {
    openDrawer();

    expect(goalBox()).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Orchestrate' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Plan' })).toBeDefined();
    const footer = elementOf(document.querySelector('[data-slot="form-actions"]'));
    expect(within(footer).getByRole('button', { name: /^Autonomy:/ })).toBeDefined();
    expect(within(footer).getByRole('button', { name: /^Starts:/ })).toBeDefined();
    expect(within(footer).getByRole('button', { name: /^Spend cap:/ })).toBeDefined();
    expect(buttonOf(within(footer).getByRole('button', { name: /start run/i })).disabled).toBe(
      true,
    );
    expect(within(footer).getByText('Set a goal to start')).toBeDefined();
  });

  it('keeps the goal when the drawer is closed and opened again', () => {
    const first = openDrawer();
    fireEvent.change(goalBox(), { target: { value: 'Stop retried webhooks' } });
    first.unmount();

    openDrawer();

    expect(goalBox().value).toBe('Stop retried webhooks');
  });

  it('starts the run on this session and closes the drawer', async () => {
    const attach = vi.fn<AppStore['attachWorkflowToSession']>(async () => undefined);
    const save = vi.fn<AppStore['savePhaseTemplate']>(async (args): Promise<Workflow> => ({
      id: args.id ?? brandedId<WorkflowId>({ value: 'wf-saved' }),
      workspaceId: args.workspaceId ?? WORKSPACE_ID,
      name: args.name,
      description: '',
      steps: [],
      createdAt: STAMP,
      updatedAt: STAMP,
    }));
    useAppStore.setState({ attachWorkflowToSession: attach, savePhaseTemplate: save });
    const onClose = vi.fn();
    openDrawer({ onClose });
    fireEvent.change(goalBox(), { target: { value: 'Stop retried webhooks' } });

    fireEvent.click(screen.getByRole('button', { name: /start run/i }));

    await waitFor(() => expect(attach).toHaveBeenCalledOnce());
    expect(attach.mock.calls[0]?.[0]).toBe(SESSION_ID);
    expect(attach.mock.calls[0]?.[2]).toMatchObject({
      goal: 'Stop retried webhooks',
      executionMode: 'dynamic',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});

describe('NewDrawer (Agent, experiment off)', () => {
  it('is the agent start of today, with Generalist picked and no message field', () => {
    openDrawer({ payload: { tab: 'agent' } });

    expect(screen.getByText('One agent in the role you pick.')).toBeDefined();
    expect(screen.getByText('Generalist')).toBeDefined();
    expect(screen.getByText('Routing')).toBeDefined();
    expect(screen.getByText('You write the first message in its chat.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Generalist' })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Start Auto')).toBeNull();
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
  });

  it('keeps the hidden roles out of the picker', () => {
    openDrawer({ payload: { tab: 'agent' } });

    for (const hidden of ['Reviewer', 'Resolver', 'Rewriter', 'Scribe', 'Report', 'Wireframe']) {
      expect(screen.queryByRole('button', { name: hidden })).toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Docs' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Scout' })).toBeDefined();
  });

  it('opens the picked role in its chat, on the same routing the popover gave', async () => {
    const onClose = vi.fn();
    openDrawer({ payload: { tab: 'agent' }, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Scout' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open Scout' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ kindOverride: 'scout', focus: 'agent' }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('offers the Suggested routing when Routing opens', () => {
    openDrawer({ payload: { tab: 'agent' } });

    fireEvent.click(screen.getByRole('button', { name: /^Agent routing:/ }));

    expect(screen.getByText('Suggested')).toBeDefined();
  });

  it('shows why inline and stays open when the agent cannot start', async () => {
    spawnAgent.mockRejectedValue(new Error('provider offline'));
    const onClose = vi.fn();
    openDrawer({ payload: { tab: 'agent' }, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Open Generalist' }));

    expect((await screen.findByRole('alert')).textContent).toContain('provider offline');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('NewDrawer (Agent, experiment on)', () => {
  beforeEach(() => {
    experiment.isOn = true;
  });

  it('is the Auto composer: a goal, one model chip and Start Auto, with no roles or guidance', () => {
    openDrawer({ payload: { tab: 'agent' } });

    expect(
      screen.getByText('Auto answers, or hands the work to the roles it picks.'),
    ).toBeDefined();
    expect(screen.queryByText('Experimental')).toBeNull();
    expect(screen.queryByText('It may not work well yet.')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Describe the work' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Auto model/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Generalist' })).toBeNull();
    expect(screen.queryByText('Routing')).toBeNull();
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
    expect(screen.queryByText(/project/i)).toBeNull();
  });

  it('keeps Start Auto disabled and says why when Claude is not connected', () => {
    useAppStore.setState({ providers: [{ ...connected('anthropic'), connection: 'missing' }] });
    openDrawer({ payload: { tab: 'agent' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });

    expect(buttonOf(screen.getByRole('button', { name: 'Start Auto' })).disabled).toBe(true);
    expect(screen.getByText('Auto runs on Claude. Connect Claude in Providers.')).toBeDefined();
  });

  it('puts Auto on Claude even when the workspace default is another provider', async () => {
    useAppStore.setState({
      providers: [connected('anthropic'), connected('codex')],
      sessions: [
        {
          ...SESSION,
          providerPreference: { defaultProvider: 'codex', allowTurnOverride: true },
        },
      ],
    });
    openDrawer({ payload: { tab: 'agent' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ provider: 'anthropic' });
  });

  it('keeps Start Auto disabled until a goal is written', () => {
    openDrawer({ payload: { tab: 'agent' } });
    const start = () => buttonOf(screen.getByRole('button', { name: 'Start Auto' }));

    expect(start().disabled).toBe(true);
    expect(screen.getByText('Set a goal to start')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });

    expect(start().disabled).toBe(false);
  });

  it('keeps the goal in memory when the experiment is turned off', () => {
    const view = openDrawer({ payload: { tab: 'agent' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });
    view.unmount();
    experiment.isOn = false;

    openDrawer({ payload: { tab: 'agent' } });
    expect(screen.queryByRole('textbox')).toBeNull();
    cleanup();
    experiment.isOn = true;
    openDrawer({ payload: { tab: 'agent' } });

    expect(textAreaOf(screen.getByRole('textbox', { name: 'Describe the work' })).value).toBe(
      'Find why webhooks retry',
    );
    expect(useAppStore.getState().newDrawerDrafts[SESSION_ID]?.autoGoal).toBe(
      'Find why webhooks retry',
    );
  });

  it('starts Auto with the goal and clears the draft', async () => {
    const onClose = vi.fn();
    openDrawer({ payload: { tab: 'agent' }, onClose });
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start Auto' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        kindOverride: 'auto',
        initialPrompt: 'Find why webhooks retry',
        focus: 'agent',
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(useAppStore.getState().newDrawerDrafts[SESSION_ID]).toBeUndefined();
  });

  it('discards the draft from the header', () => {
    openDrawer({ payload: { tab: 'agent' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Find why webhooks retry' },
    });

    fireEvent.click(screen.getByRole('button', { name: /discard draft/i }));

    expect(textAreaOf(screen.getByRole('textbox', { name: 'Describe the work' })).value).toBe('');
    expect(useAppStore.getState().newDrawerDrafts[SESSION_ID]).toBeUndefined();
  });

  it('keeps a separate draft for Run and for Agent', () => {
    openDrawer();
    fireEvent.change(goalBox(), { target: { value: 'the run goal' } });
    fireEvent.click(tab('Agent'));
    expect(textAreaOf(screen.getByRole('textbox', { name: 'Describe the work' })).value).toBe('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'the agent goal' },
    });
    fireEvent.click(tab('Run'));

    expect(goalBox().value).toBe('the run goal');
    act(() => undefined);
  });
});

describe('NewDrawer (Write)', () => {
  it('writes a report by default, with every field the page had', () => {
    openDrawer({ payload: { tab: 'write' } });

    expect(screen.getByText('A report or a wireframe, written from this session.')).toBeDefined();
    expect(isSelected('Write')).toBe(true);
    expect(screen.getByRole('tab', { name: 'Report' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('artifact-brief')).toBeDefined();
    expect(screen.getByText('Included context')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^add guidance/i })).toBeNull();
  });

  it('switches to the wireframe fields and back without losing the report draft', () => {
    openDrawer({ payload: { tab: 'write' } });
    fireEvent.change(screen.getByTestId('artifact-brief'), { target: { value: 'the rounding' } });

    fireEvent.click(screen.getByRole('tab', { name: 'Wireframe' }));
    expect(screen.getByTestId('artifact-brief')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Report' }));

    expect(textAreaOf(screen.getByTestId('artifact-brief')).value).toBe('the rounding');
  });

  it('shows the note a retry carries', () => {
    openDrawer({
      payload: { tab: 'write', writeKind: 'report', note: 'Retrying the last report' },
    });

    expect(screen.getByTestId('artifact-creation-note').textContent).toBe(
      'Retrying the last report',
    );
  });
});
