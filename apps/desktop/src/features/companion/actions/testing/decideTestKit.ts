import { vi } from 'vitest';
import type { AppStore } from '../../../../store/store';
import type { DecidePorts } from '../handlerTypes';
import { permissionHashOf, questionVersionOf, slackDraftVersionOf } from '../versions';

export const WORKSPACE = 'ws-harborline';
export const SESSION = 'ses-ledger-core';
export const AGENT = 'agent-implementer';
export const LEAD = 'agent-lead';
export const RUN = 'run-1';
export const PLAN = 'plan-1';
export const TOOL_USE = 'tool-use-1';
export const QUESTION_ID = 'question-1';
export const DRAFT_ID = 'draft-1';

const AT = '2026-11-25T10:00:00.000Z';

export const QUESTION = {
  id: QUESTION_ID,
  sessionId: SESSION,
  text: 'Which currency does the ledger use?',
  suggestedAnswers: ['EUR', 'USD'],
  createdAt: AT,
  status: 'open',
  createdByAgentId: AGENT,
};

export const DRAFT = {
  id: DRAFT_ID,
  sessionId: SESSION,
  body: 'Shipping the fix to payments-api today.',
  updatedAt: AT,
};

export const PERMISSION_INPUT = { command: 'rm -rf node_modules' };

export const QUESTION_VERSION = questionVersionOf({ question: QUESTION });
export const DRAFT_VERSION = slackDraftVersionOf({ draft: DRAFT });
export const PERMISSION_HASH = permissionHashOf({ toolName: 'Bash', input: PERMISSION_INPUT });

const blankStore = (): AppStore => Object.create(null);

export type FakeActions = {
  readonly answerOpenQuestions: ReturnType<typeof vi.fn>;
  readonly allowAndContinue: ReturnType<typeof vi.fn>;
  readonly denyWithReason: ReturnType<typeof vi.fn>;
  readonly setSessionBudget: ReturnType<typeof vi.fn>;
  readonly closeWorkflowRun: ReturnType<typeof vi.fn>;
  readonly continueWorkflowRun: ReturnType<typeof vi.fn>;
  readonly cancelTurnConfirmed: ReturnType<typeof vi.fn>;
  readonly continueStoppedAgent: ReturnType<typeof vi.fn>;
  readonly sendTurn: ReturnType<typeof vi.fn>;
  readonly decideSessionSlackDraft: ReturnType<typeof vi.fn>;
  readonly loadAgentTranscript: ReturnType<typeof vi.fn>;
};

export type TestStore = {
  readonly store: AppStore;
  readonly actions: FakeActions;
  readonly ports: DecidePorts;
  readonly approvePlan: ReturnType<typeof vi.fn>;
};

type BuildParams = {
  readonly state?: Record<string, unknown>;
};

export const buildTestStore = ({ state = {} }: BuildParams = {}): TestStore => {
  const actions: FakeActions = {
    answerOpenQuestions: vi.fn(async () => undefined),
    allowAndContinue: vi.fn(async () => undefined),
    denyWithReason: vi.fn(async () => undefined),
    setSessionBudget: vi.fn(async () => undefined),
    closeWorkflowRun: vi.fn(async () => 'closed'),
    continueWorkflowRun: vi.fn(async () => undefined),
    cancelTurnConfirmed: vi.fn(async () => ({ outcome: 'exited', exitedAt: AT })),
    continueStoppedAgent: vi.fn(async () => undefined),
    sendTurn: vi.fn(async () => ({ blockedOverBudget: false })),
    decideSessionSlackDraft: vi.fn(async () => undefined),
    loadAgentTranscript: vi.fn(async () => undefined),
  };
  const approvePlan = vi.fn<DecidePorts['approvePlan']>(async () => ({
    kind: 'approved',
    revision: 3,
  }));
  const store: AppStore = Object.assign(blankStore(), {
    ...actions,
    sessions: [
      {
        id: SESSION,
        workspaceId: WORKSPACE,
        workflowRuns: [{ id: RUN, workflowId: 'wf-1', orchestrationOutcome: 'blocked' }],
      },
    ],
    sessionOpenQuestions: { [SESSION]: [QUESTION] },
    sessionAnsweredQuestions: {},
    sessionDismissedQuestions: {},
    sessionPhaseRuns: {
      [SESSION]: [{ id: AGENT, status: 'running', workflowRunId: RUN }],
    },
    agentTurnState: { [AGENT]: { kind: 'blocked', runId: 'provider-run-1', blockedAt: AT } },
    transcripts: {
      [AGENT]: [
        {
          kind: 'permission_request',
          runId: 'provider-run-1',
          toolUseId: TOOL_USE,
          toolName: 'Bash',
          input: PERMISSION_INPUT,
          at: AT,
        },
      ],
    },
    autoTreeViews: {
      [SESSION]: [
        {
          tree: { id: 'tree-1', rootAgentId: LEAD },
          delegations: [],
          hiddenChildIds: [],
          level: 'plan',
          artifacts: [
            {
              status: 'active',
              revision: 3,
              artifact: {
                artifactId: PLAN,
                kind: 'plan',
                approvalState: 'needs_approval',
                ownerAgentId: LEAD,
                createdAt: 1,
              },
            },
          ],
        },
      ],
    },
    sessionBudgets: { [SESSION]: { softCapUsd: 10, onExceed: 'pause' } },
    sessionSlackDrafts: { [SESSION]: [DRAFT] },
    ...state,
  });
  return { store, actions, ports: { approvePlan }, approvePlan };
};

type FixtureParams = {
  readonly value: unknown;
};

export const fixtureOf = <Shape>({ value }: FixtureParams): Shape =>
  JSON.parse(JSON.stringify(value));
