// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

const { discardUncreatedSession } = vi.hoisted(() => ({
  discardUncreatedSession: vi.fn(async (_params: unknown) => undefined),
}));

vi.mock('../sessions/discardUncreatedSession', () => ({
  discardUncreatedSession: (params: unknown) => discardUncreatedSession(params),
}));

import { createSessionDraftSlice } from './index';
import { EMPTY_SESSION_DRAFT, initialSessionDraftState } from './state';
import { selectSessionDraft } from './selectSessionDraft';
import { selectIsSessionDraftShown } from './selectIsSessionDraftShown';
import { hasSessionDraftContent } from './hasSessionDraftContent';
import { SESSION_DRAFT_PLACE } from '../navigation/place';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'sess-1' as SessionId;

type HarnessState = Record<string, unknown> & {
  sessionDrafts: Record<string, unknown>;
  openSessionDraftWorkspaceId: WorkspaceId | null;
};

const harness = () => {
  const spies = {
    navigate: vi.fn(),
    createSession: vi.fn(async (_input: unknown) => ({ session: { id: SESSION_ID } })),
    attachWorkflowToSession: vi.fn(async () => undefined),
    spawnAgent: vi.fn(async () => 'agent-1'),
  };
  let state: HarnessState = {
    ...initialSessionDraftState,
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: null,
    ...spies,
  };
  const set = (patch: Partial<HarnessState> | ((s: HarnessState) => Partial<HarnessState>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  };
  const get = () => ({ ...state, ...slice });
  const slice = createSessionDraftSlice(set as never, get as never);
  return { slice, spies, getState: () => state, set };
};

let h = harness();

beforeEach(() => {
  h = harness();
  discardUncreatedSession.mockClear();
});

describe('session draft slice', () => {
  it('opens the draft as a place of its own, writing nothing', () => {
    h.slice.openSessionDraft();

    expect(h.spies.navigate).toHaveBeenCalledWith({ to: SESSION_DRAFT_PLACE });
    expect(h.spies.createSession).not.toHaveBeenCalled();
  });

  it('keeps one draft per workspace and finds it intact', () => {
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { workflowGoal: 'Ship it' } });
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { choice: 'workflow' } });

    const draft = selectSessionDraft({ state: h.getState() as never, workspaceId: WORKSPACE_ID });
    expect(draft).toEqual({ ...EMPTY_SESSION_DRAFT, workflowGoal: 'Ship it', choice: 'workflow' });
    expect(hasSessionDraftContent({ draft })).toBe(true);
    expect(
      selectSessionDraft({ state: h.getState() as never, workspaceId: 'ws-2' as WorkspaceId }),
    ).toBe(EMPTY_SESSION_DRAFT);
  });

  it('counts a choice alone as no content', () => {
    expect(hasSessionDraftContent({ draft: { ...EMPTY_SESSION_DRAFT, choice: 'scout' } })).toBe(
      false,
    );
  });

  it('discards the draft', () => {
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { agentPrompt: 'look' } });
    h.slice.discardSessionDraft({ workspaceId: WORKSPACE_ID });

    expect(selectSessionDraft({ state: h.getState() as never, workspaceId: WORKSPACE_ID })).toBe(
      EMPTY_SESSION_DRAFT,
    );
  });

  it('shows the draft only on its workspace and with no session open', () => {
    const base = {
      openSessionDraftWorkspaceId: WORKSPACE_ID,
      currentWorkspaceId: WORKSPACE_ID,
      currentSessionId: null,
    };
    expect(selectIsSessionDraftShown({ state: base })).toBe(true);
    expect(selectIsSessionDraftShown({ state: { ...base, currentSessionId: SESSION_ID } })).toBe(
      false,
    );
    expect(
      selectIsSessionDraftShown({ state: { ...base, currentWorkspaceId: 'ws-2' as WorkspaceId } }),
    ).toBe(false);
  });

  it('creates the session and starts the workflow in one gesture, then drops the draft', async () => {
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { workflowGoal: 'Ship it' } });
    const run = vi.fn(async (_session: unknown) => undefined);

    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow-run', goal: '  Ship it  ', run },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Ship it',
      title: 'Ship it',
      omitGoalSlot: false,
    });
    expect(run).toHaveBeenCalledWith({ id: SESSION_ID });
    expect(h.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(h.getState().sessionDrafts).toEqual({});
    expect(h.getState().goodboyNamedSessionId).toBe(SESSION_ID);
  });

  it('names a Scout session from the first sentence of its focus', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'scout',
        focus: 'Look at the importer. Then the exporter.',
        prompt: 'Read this project',
        routing: null,
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Look at the importer.',
      title: 'Look at the importer.',
      omitGoalSlot: false,
    });
    expect(h.spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'scout',
      initialPrompt: 'Read this project',
      focus: 'agent',
    });
  });

  it('creates the session in the project the draft carries', async () => {
    h.slice.patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { projectId: 'project-ledger-core' as ProjectId },
    });

    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'scout',
        focus: 'Find one small bug',
        prompt: 'Read this project',
        routing: null,
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Find one small bug',
      title: 'Find one small bug',
      omitGoalSlot: false,
      projectId: 'project-ledger-core',
    });
    expect(h.getState().sessionDrafts).toEqual({});
  });

  it('gives a Scout with no focus a plain title and no goal', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'scout',
        focus: '  ',
        prompt: 'Read this project',
        routing: null,
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Scout the project',
      title: 'Scout the project',
      omitGoalSlot: true,
    });
  });

  it('passes a pinned routing override to spawnAgent for any role', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'implementer',
        focus: 'Build the login page',
        prompt: 'Build the login page',
        routing: { provider: 'anthropic', model: 'claude-sonnet-5', effort: 'medium' },
      },
    });

    expect(h.spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'implementer',
      initialPrompt: 'Build the login page',
      focus: 'agent',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: 'medium',
    });
  });

  it('gives a non-Scout role a fallback title when there is no goal text', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        agentKind: 'implementer',
        focus: '  ',
        prompt: 'Build something',
        routing: null,
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Implement the project',
      title: 'Implement the project',
      omitGoalSlot: true,
    });
  });

  it('links the issue and writes title and goal when a task starts', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          title: 'Invoices credited twice',
          url: 'https://linear.app/northwind/issue/NW-214',
          goal: 'Stop crediting twice.',
          body: '',
          branchSlug: 'invoices-credited-twice',
        },
        title: 'Invoices credited twice',
        goal: 'Stop crediting twice.',
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Stop crediting twice.',
      title: 'Invoices credited twice',
      omitGoalSlot: false,
      externalTasks: [
        {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          url: 'https://linear.app/northwind/issue/NW-214',
          title: 'Invoices credited twice',
        },
      ],
    });
    expect(h.spies.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(h.spies.spawnAgent).not.toHaveBeenCalled();
  });

  it('links the issue, mounts the issue project and runs the workflow in one gesture', async () => {
    h.slice.patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { projectId: 'project-other' as ProjectId },
    });
    const run = vi.fn(async (_session: unknown) => undefined);
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          title: 'Invoices credited twice',
          url: 'https://linear.app/northwind/issue/NW-214',
          goal: 'Stop crediting twice.',
          body: '',
          branchSlug: 'invoices-credited-twice',
        },
        title: 'Invoices credited twice',
        goal: 'Stop crediting twice.',
        then: { kind: 'workflow-run', run },
        mount: { projectId: 'project-ledger' as ProjectId, reason: 'from GitHub repo acme/ledger' },
      },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-ledger',
        projectReason: 'from GitHub repo acme/ledger',
        externalTasks: [expect.objectContaining({ identifier: 'NW-214' })],
      }),
    );
    expect(run).toHaveBeenCalledWith({ id: SESSION_ID });
    expect(h.spies.spawnAgent).not.toHaveBeenCalled();
  });

  it('starts a task with no project when the issue mount is set to none', async () => {
    h.slice.patchSessionDraft({
      workspaceId: WORKSPACE_ID,
      patch: { projectId: 'project-other' as ProjectId },
    });
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          title: 'Invoices credited twice',
          url: 'https://linear.app/northwind/issue/NW-214',
          goal: 'Stop crediting twice.',
          body: '',
          branchSlug: 'invoices-credited-twice',
        },
        title: 'Invoices credited twice',
        goal: 'Stop crediting twice.',
        mount: { projectId: null, reason: 'from GitHub repo acme/ledger' },
      },
    });

    const [input] = h.spies.createSession.mock.calls[0] ?? [];
    expect(input).not.toHaveProperty('projectId');
    expect(input).not.toHaveProperty('projectReason');
  });

  it('links the issue and spawns an agent in the same gesture when the task has a "then"', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'task',
        candidate: {
          provider: 'linear',
          externalId: 'issue-214',
          identifier: 'NW-214',
          title: 'Invoices credited twice',
          url: 'https://linear.app/northwind/issue/NW-214',
          goal: 'Stop crediting twice.',
          body: '',
          branchSlug: 'invoices-credited-twice',
        },
        title: 'Invoices credited twice',
        goal: 'Stop crediting twice.',
        then: {
          kind: 'agent',
          agentKind: 'implementer',
          prompt: 'Stop crediting twice.',
          routing: null,
        },
      },
    });

    expect(h.spies.spawnAgent).toHaveBeenCalledWith(SESSION_ID, {
      kindOverride: 'implementer',
      initialPrompt: 'Stop crediting twice.',
      focus: 'agent',
    });
    expect(h.spies.attachWorkflowToSession).not.toHaveBeenCalled();
  });

  it('leaves no session behind and keeps the draft when the start fails', async () => {
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { workflowGoal: 'Ship it' } });
    const run = vi.fn(async (_session: unknown) => {
      throw new Error('no provider');
    });

    await expect(
      h.slice.startSessionFromDraft({
        workspaceId: WORKSPACE_ID,
        start: { kind: 'workflow-run', goal: 'Ship it', run },
      }),
    ).rejects.toThrow('no provider');

    expect(discardUncreatedSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
    expect(h.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
    expect(
      selectSessionDraft({ state: h.getState() as never, workspaceId: WORKSPACE_ID }).workflowGoal,
    ).toBe('Ship it');
  });

  it('starts a blank session with nothing required and keeps the draft', async () => {
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { workflowGoal: 'Ship it' } });

    await h.slice.startBlankSession({ workspaceId: WORKSPACE_ID });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: '',
      omitGoalSlot: true,
    });
    expect(h.spies.attachWorkflowToSession).not.toHaveBeenCalled();
    expect(h.spies.spawnAgent).not.toHaveBeenCalled();
    expect(h.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(h.getState().goodboyNamedSessionId).toBeNull();
    expect(
      selectSessionDraft({ state: h.getState() as never, workspaceId: WORKSPACE_ID }).workflowGoal,
    ).toBe('Ship it');
  });

  it('creates the session first, then runs the builder workflow on it, in one action', async () => {
    const order: Array<string> = [];
    h.spies.createSession.mockImplementationOnce(async () => {
      order.push('session');
      return { session: { id: SESSION_ID } };
    });
    const run = vi.fn(async (session: { readonly id: string }) => {
      order.push(`run:${session.id}`);
    });
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });

    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow-run', goal: ' Ship it ', run },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, goal: 'Ship it', title: 'Ship it' }),
    );
    expect(order).toEqual(['session', `run:${SESSION_ID}`]);
    expect(h.getState().openSessionDraftWorkspaceId).toBeNull();
  });

  it('leaves no session behind when the builder run fails', async () => {
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });
    const run = vi.fn(async () => {
      throw new Error('no provider');
    });

    await expect(
      h.slice.startSessionFromDraft({
        workspaceId: WORKSPACE_ID,
        start: { kind: 'workflow-run', goal: 'Ship it', run },
      }),
    ).rejects.toThrow('no provider');
    expect(discardUncreatedSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
    expect(h.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
  });
});
