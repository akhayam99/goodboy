// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { NeedsYouMove } from '../../board/needsYou/needsYouOf';
import { expectedActionIdOf } from '../actions/actionIds';
import {
  AGENT,
  DRAFT,
  LEAD,
  PERMISSION_INPUT,
  PLAN,
  QUESTION,
  RUN,
  SESSION,
  TOOL_USE,
  WORKSPACE,
  fixtureOf,
} from '../actions/decideTestKit';
import { clearSendSequences } from '../actions/sendSequence';
import { decisionOfMove } from './decisionOfMove';
import { runsFieldsOf } from './runsFieldsOf';
import type { WorkspaceScope } from './workspaceScope';

const AT = '2026-11-25T10:00:00.000Z';

const PLAN_SOURCE = [
  '# Retry window',
  '- Add the retry window to `src/webhook/retry.ts`',
  '- Cover it with a test in `src/webhook/retry.test.ts`',
  '- Read /Users/someone/secret/notes.md first',
].join('\n');

const scopeOf = (): WorkspaceScope =>
  fixtureOf<WorkspaceScope>({
    value: {
      workspace: { id: WORKSPACE, name: 'Harborline' },
      sessions: [
        {
          id: SESSION,
          workspaceId: WORKSPACE,
          workflowRuns: [{ id: RUN, workflowId: 'wf-1', orchestrationStop: { kind: 'paused' } }],
        },
      ],
      infos: {},
      openQuestions: { [SESSION]: [QUESTION] },
      agents: {
        [SESSION]: [
          { id: AGENT, name: 'Builder', status: 'blocked', workflowRunId: RUN, runId: 'p1' },
          { id: LEAD, name: 'Lead', status: 'running', workflowRunId: RUN, runId: 'p2' },
        ],
      },
      projectNames: {},
      tasks: {},
      pullRequests: {},
      pullRequestFacts: {},
      spendUsd: {},
      telemetry: {
        [SESSION]: [{ runId: 'p1', model: 'opus-5', estimatedCostUsd: 0.04, recordedAt: AT }],
      },
      budgets: { [SESSION]: { softCapUsd: 10, onExceed: 'pause' } },
      slackDrafts: { [SESSION]: [{ ...DRAFT, status: 'pending' }] },
      trees: {
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
                title: 'Retry window plan',
                sourceText: PLAN_SOURCE,
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
      transcripts: {
        [AGENT]: [
          {
            kind: 'permission_request',
            runId: 'provider-run-1',
            toolUseId: TOOL_USE,
            toolName: 'Bash',
            input: { command: 'cat /Users/someone/secret/notes.md' },
            at: AT,
          },
        ],
      },
      turnStates: { [AGENT]: { kind: 'blocked', runId: 'provider-run-1', blockedAt: AT } },
      decisions: {},
    },
  });

const moveOf = (reason: NeedsYouMove['reason'], questionId: string | null): NeedsYouMove =>
  fixtureOf<NeedsYouMove>({
    value: {
      id: `${SESSION}:${reason}`,
      sessionId: SESSION,
      reason,
      questionId,
      title: 'x',
      since: 1,
    },
  });

const base = { actionId: '', workspaceId: WORKSPACE, sessionId: SESSION };

describe('every decision carries an id the executor accepts', () => {
  it('names the question with the version it was asked at and offers its options', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('open-question', QUESTION.id),
      question: fixtureOf({ value: QUESTION }),
    });

    expect(decision?.kind).toBe('question');
    if (decision?.kind !== 'question') {
      return;
    }
    expect(decision.options).toEqual(['EUR', 'USD']);
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'answerQuestion',
          ...base,
          questionId: decision.questionId,
          seenVersion: decision.version,
          text: '',
        },
      }),
    );
  });

  it('carries the plan with its steps, its touches and both action ids, and no absolute path', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('plan-approval', null),
      question: undefined,
    });

    expect(decision?.kind).toBe('plan');
    if (decision?.kind !== 'plan') {
      return;
    }
    expect(decision.touches).toEqual(['src/webhook/retry.ts', 'src/webhook/retry.test.ts']);
    expect(decision.steps).toHaveLength(3);
    expect(JSON.stringify(decision)).not.toContain('/Users/');
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'approvePlan',
          ...base,
          planId: decision.planId,
          seenPlanVersion: decision.planVersion,
        },
      }),
    );
    expect(decision.requestChangesActionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'requestPlanChanges',
          ...base,
          planId: decision.planId,
          seenPlanVersion: decision.planVersion,
          text: '',
        },
      }),
    );
  });

  it('carries the permission with the line that stopped the agent, without a home path', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('needs-approval', null),
      question: undefined,
    });

    expect(decision?.kind).toBe('permission');
    if (decision?.kind !== 'permission') {
      return;
    }
    expect(decision.command).toBe('cat notes.md');
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'answerPermission',
          ...base,
          agentId: decision.agentId,
          requestId: decision.requestId,
          seenInputHash: decision.inputHash,
          verdict: 'allow',
        },
      }),
    );
  });

  it('offers only the amounts the Mac offers for a paused limit', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('run-paused-at-limit', null),
      question: undefined,
    });

    expect(decision?.kind).toBe('limit');
    if (decision?.kind !== 'limit') {
      return;
    }
    expect(decision.offers.map((offer) => offer.amount)).toEqual([15, 20]);
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'raiseLimit',
          ...base,
          runId: decision.runId,
          seenLimit: decision.currentLimit,
          offeredAmount: 15,
        },
      }),
    );
  });

  it('carries the slack draft with its version', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('slack-reply-waiting', null),
      question: undefined,
    });

    expect(decision?.kind).toBe('slack');
    if (decision?.kind !== 'slack') {
      return;
    }
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'answerSlackReply',
          ...base,
          draftId: decision.draftId,
          seenVersion: decision.version,
          verdict: 'send',
          text: '',
        },
      }),
    );
  });

  it('carries a run that waits for a go with the state it was seen in', () => {
    const decision = decisionOfMove({
      scope: scopeOf(),
      move: moveOf('run-waits-for-go', null),
      question: undefined,
    });

    expect(decision?.kind).toBe('run');
    if (decision?.kind !== 'run') {
      return;
    }
    expect(decision.actionId).toBe(
      expectedActionIdOf({
        action: {
          kind: 'continueRun',
          ...base,
          runId: decision.runId,
          seenState: decision.seenState,
        },
      }),
    );
  });
});

describe('run and agent rows carry the ids the executor expects', () => {
  it('builds every row id, marks the Lead and stops its tree with one id', () => {
    clearSendSequences();
    const scope = scopeOf();
    const session = scope.sessions[0];
    if (session === undefined) {
      throw new Error('scope has no session');
    }

    const { runs } = runsFieldsOf({ scope, session, now: Date.parse(AT) });

    const run = runs[0];
    expect(run?.continueActionId).toBe(
      expectedActionIdOf({
        action: { kind: 'continueRun', ...base, runId: RUN, seenState: run?.state ?? 'running' },
      }),
    );
    const lead = run?.agents.find((agent) => agent.agentId === LEAD);
    expect(lead?.isLead).toBe(true);
    expect(lead?.role).toBe('Lead');
    expect(lead?.stopTreeActionId).toBe(
      expectedActionIdOf({
        action: { kind: 'stopAgentTree', ...base, agentId: LEAD, seenState: 'running' },
      }),
    );
    expect(lead?.stopActionId).toBe(
      expectedActionIdOf({
        action: { kind: 'stopAgent', ...base, agentId: LEAD, seenState: 'running' },
      }),
    );
    const builder = run?.agents.find((agent) => agent.agentId === AGENT);
    expect(builder?.isLead).toBe(false);
    expect(builder?.stopTreeActionId).toBeNull();
    expect(builder?.model).toBe('opus-5');
    expect(builder?.spendText).toBe('$0.04');
    expect(builder?.sendActionId).toBe(
      expectedActionIdOf({
        action: { kind: 'sendToAgent', ...base, agentId: AGENT, seenVersion: '0', text: '' },
      }),
    );
  });
});
