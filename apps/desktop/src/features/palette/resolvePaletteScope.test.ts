// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { resolvePaletteScope } from './resolvePaletteScope';
import type { HeldScope } from './types';

type CommitScope = Extract<HeldScope, { kind: 'commit' }>;

const WORKSPACE = 'workspace-harborline' as WorkspaceId;
const SESSION = 'session-payout' as SessionId;
const AGENT = 'agent-implementer' as AgentId;
const RUN = 'run-ship-a-fix' as WorkflowRunId;

const base = {
  currentWorkspaceId: WORKSPACE,
  currentSessionId: SESSION,
  selectedAgentId: null,
  hasStudio: false,
  heldScope: null,
};

describe('resolvePaletteScope', () => {
  it('is the workspace on the Board', () => {
    expect(resolvePaletteScope({ ...base, currentSessionId: null })).toEqual({
      kind: 'workspace',
      workspaceId: WORKSPACE,
    });
  });

  it('is nothing without a workspace', () => {
    expect(
      resolvePaletteScope({ ...base, currentWorkspaceId: null, currentSessionId: null }),
    ).toBeNull();
  });

  it('is the session on a session page', () => {
    expect(resolvePaletteScope({ ...base, lens: 'questions' })).toEqual({
      kind: 'session',
      sessionId: SESSION,
    });
  });

  it('is the agent only while the agent page is the visible surface', () => {
    expect(resolvePaletteScope({ ...base, selectedAgentId: AGENT, lens: 'agents' })).toEqual({
      kind: 'agent',
      sessionId: SESSION,
      agentId: AGENT,
    });
  });

  it('is not the agent when a stored selection sits under an artifact conversation', () => {
    expect(
      resolvePaletteScope({
        ...base,
        selectedAgentId: AGENT,
        artifactConversationAgentId: AGENT,
        lens: 'plans',
      }),
    ).toEqual({ kind: 'session', sessionId: SESSION });
  });

  it('is the session, not the agent, while a session studio covers the page', () => {
    expect(resolvePaletteScope({ ...base, selectedAgentId: AGENT, hasStudio: true })).toEqual({
      kind: 'session',
      sessionId: SESSION,
    });
  });

  it('is the workspace while an app studio is open over a session', () => {
    expect(resolvePaletteScope({ ...base, selectedAgentId: AGENT, hasAppStudio: true })).toEqual({
      kind: 'workspace',
      workspaceId: WORKSPACE,
    });
  });

  it('is the run on the Runs page with a run in focus', () => {
    expect(resolvePaletteScope({ ...base, lens: 'workflows', focusedRunId: RUN })).toEqual({
      kind: 'workflowRun',
      sessionId: SESSION,
      runId: RUN,
    });
  });

  it('is the session on the Runs page with no run in focus', () => {
    expect(resolvePaletteScope({ ...base, lens: 'workflows' })).toEqual({
      kind: 'session',
      sessionId: SESSION,
    });
  });

  it('is the pull request on the Branch page of a session that has one', () => {
    expect(resolvePaletteScope({ ...base, lens: 'branch', prNumber: 318 })).toEqual({
      kind: 'pullRequest',
      sessionId: SESSION,
      prNumber: 318,
    });
    expect(resolvePaletteScope({ ...base, lens: 'branch' })).toEqual({
      kind: 'session',
      sessionId: SESSION,
    });
  });

  it('keeps a focused commit above everything', () => {
    const noop = () => undefined;
    const held: CommitScope = {
      kind: 'commit',
      sessionId: SESSION,
      facts: {
        sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
        shortSha: 'b2c3d4e',
        subject: 'Keep trailing-comma rows in the ledger-core importer',
        isFolded: false,
        isRemoved: false,
        canRemove: true,
        canFoldDown: true,
        onRename: noop,
        onFoldDown: noop,
        onSquashDown: noop,
        onToggleRemove: noop,
        onSeparate: noop,
        onMove: noop,
      },
    };

    expect(
      resolvePaletteScope({ ...base, hasAppStudio: true, lens: 'workflows', heldScope: held }),
    ).toBe(held);
  });

  it('keeps a focused Explore row above the lens it sits in', () => {
    const held: HeldScope = {
      kind: 'exploreFile',
      sessionId: SESSION,
      facts: {
        name: 'rounding.ts',
        relPath: 'apps/ledger-core/rounding.ts',
        absolutePath: '/work/settlement/apps/ledger-core/rounding.ts',
        isDir: false,
        openLabel: 'Open in editor',
        editorLabel: 'VS Code',
        onAsk: null,
        onOpen: null,
        onReveal: null,
      },
    };

    expect(resolvePaletteScope({ ...base, lens: 'explore', heldScope: held })).toBe(held);
  });
});
