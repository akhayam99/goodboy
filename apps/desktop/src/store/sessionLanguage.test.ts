import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { buildSessionLanguageGuard, resolveSessionLanguageGoal } from './sessionLanguage';

const NOW = '2026-01-01T00:00:00.000Z' as IsoDateTime;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;

const ITALIAN_GOAL = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const session = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'session level goal',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [run()],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const workflow = (overrides: Partial<Workflow> = {}): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  name: 'flow',
  description: '',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

describe('resolveSessionLanguageGoal', () => {
  it('prefers the goal the operator set on the run', () => {
    const resolved = resolveSessionLanguageGoal({
      session: session({ workflowRuns: [run({ goal: ITALIAN_GOAL })] }),
      workflows: [workflow({ goal: 'template goal' })],
      workflowRunId: RUN_ID,
    });

    expect(resolved).toBe(ITALIAN_GOAL);
  });

  it('falls back to the workflow goal when the run carries none', () => {
    const resolved = resolveSessionLanguageGoal({
      session: session(),
      workflows: [workflow({ goal: ITALIAN_GOAL })],
      workflowRunId: RUN_ID,
    });

    expect(resolved).toBe(ITALIAN_GOAL);
  });

  it('falls back to the session goal outside any workflow run', () => {
    const resolved = resolveSessionLanguageGoal({
      session: session({ goal: ITALIAN_GOAL }),
      workflows: [workflow()],
    });

    expect(resolved).toBe(ITALIAN_GOAL);
  });

  it('resolves the same goal for a sub-step of the run as for the step itself', () => {
    const state = {
      session: session({ workflowRuns: [run({ goal: ITALIAN_GOAL })] }),
      workflows: [workflow({ goal: 'template goal' })],
      workflowRunId: RUN_ID,
    };

    expect(resolveSessionLanguageGoal(state)).toBe(resolveSessionLanguageGoal(state));
    expect(resolveSessionLanguageGoal(state)).toBe(ITALIAN_GOAL);
  });

  it('returns an empty string when nothing states a goal', () => {
    expect(
      resolveSessionLanguageGoal({
        session: session({ goal: '   ', workflowRuns: [] }),
        workflows: [],
      }),
    ).toBe('');
  });
});

describe('buildSessionLanguageGuard', () => {
  it('quotes the goal and pins the turn to the language it is written in', () => {
    const guard = buildSessionLanguageGuard({
      anchor: { source: 'goal', text: ITALIAN_GOAL },
    });

    expect(guard).toContain('[session-language]');
    expect(guard).toContain('The operator stated the goal of this session as:');
    expect(guard).toContain(ITALIAN_GOAL);
    expect(guard).toContain('Answer in the language that goal is written in');
  });

  it('states that a plan or a summary in another language changes nothing', () => {
    const guard = buildSessionLanguageGuard({
      anchor: { source: 'goal', text: ITALIAN_GOAL },
    });

    expect(guard).toContain(
      'whatever language the plan, the carried context, the step summaries, or your own tooling use',
    );
    expect(guard).toContain('never by anything it asks for');
  });

  it('quotes the latest message and pins the turn to its language', () => {
    const guard = buildSessionLanguageGuard({
      anchor: { source: 'message', text: ITALIAN_GOAL },
    });

    expect(guard).toContain('The operator last wrote to this session:');
    expect(guard).toContain('Answer in the language that message is written in');
    expect(guard).toContain('The message fixes that language');
  });

  it('emits nothing when either anchor source has blank text', () => {
    expect(buildSessionLanguageGuard({ anchor: { source: 'goal', text: '   ' } })).toBe('');
    expect(buildSessionLanguageGuard({ anchor: { source: 'message', text: '   ' } })).toBe('');
  });
});
