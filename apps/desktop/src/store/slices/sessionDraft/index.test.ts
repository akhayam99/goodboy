import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';

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

    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'workflow', workflowId: 'wf-1' as WorkflowId, goal: '  Ship it  ' },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Ship it',
      title: 'Ship it',
      omitGoalSlot: false,
    });
    expect(h.spies.attachWorkflowToSession).toHaveBeenCalledWith(SESSION_ID, 'wf-1', {
      goal: 'Ship it',
      navigate: true,
    });
    expect(h.getState().openSessionDraftWorkspaceId).toBeNull();
    expect(h.getState().sessionDrafts).toEqual({});
  });

  it('names a Scout session from the first sentence of its focus', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: {
        kind: 'scout',
        focus: 'Look at the importer. Then the exporter.',
        prompt: 'Read this project',
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

  it('gives a Scout with no focus a plain title and no goal', async () => {
    await h.slice.startSessionFromDraft({
      workspaceId: WORKSPACE_ID,
      start: { kind: 'scout', focus: '  ', prompt: 'Read this project' },
    });

    expect(h.spies.createSession).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      goal: 'Scout the project',
      title: 'Scout the project',
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

  it('leaves no session behind and keeps the draft when the start fails', async () => {
    h.set({ openSessionDraftWorkspaceId: WORKSPACE_ID });
    h.slice.patchSessionDraft({ workspaceId: WORKSPACE_ID, patch: { workflowGoal: 'Ship it' } });
    h.spies.attachWorkflowToSession.mockRejectedValueOnce(new Error('no provider'));

    await expect(
      h.slice.startSessionFromDraft({
        workspaceId: WORKSPACE_ID,
        start: { kind: 'workflow', workflowId: 'wf-1' as WorkflowId, goal: 'Ship it' },
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
});
