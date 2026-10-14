import type { Agent, AgentId, PrCheckRun, PullRequestState, TurnEvent } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { resolveSessionRepo } from '../../../../../store/slices/worktrees/resolveSessionRepo';
import { ciFixName } from '../../../../../features/branch/checks/ciFixName';
import { buildAnalyzeChecksPrompt } from '../../../../../features/branch/checks/buildAnalyzeChecksPrompt';
import { sceneClock } from '../../sceneClock';
import { SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

const DEBUGGER_ID: AgentId = JSON.parse(JSON.stringify('mock-u24-checks-analyze-debugger'));
const clock = sceneClock({ anchor: '2026-10-10T09:40:00.000Z' });
const now = clock.iso({ at: '2026-10-10T09:40:00.000Z' });
const check: PrCheckRun = {
  name: 'payments-api / test',
  conclusion: 'failure',
  detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
  durationMs: 92_000,
};
const pullRequest: PullRequestState = {
  number: 318,
  title: 'Prevent duplicate credits',
  url: 'https://github.com/harborline/payments-api/pull/318',
  headSha: 'a13bc4d',
  headBranch: 'acme/fix-credits',
  baseBranch: 'main',
  checks: 'failure',
  state: 'open',
  isDraft: false,
  mergeable: false,
  reviewDecision: null,
  body: '',
  updatedAt: now,
};
const log =
  'FAIL src/ledger.test.ts\nExpected credits: 1\nReceived credits: 2\nRetry applies the same credit twice.';
const proposal =
  '## Finding\nThe retry path does not check whether the invoice was already credited.\n\n## Proposed fix\nAdd an idempotency guard in src/ledger.ts and a retry test in src/ledger.test.ts.\nRun the ledger-core unit suite.\n\n```diff\n--- a/src/ledger.ts\n+++ b/src/ledger.ts\n@@ -1,1 +1,2 @@\n+if (hasCredit(invoice)) return;\n applyCredit(invoice);\n```';

type Params = {
  readonly phase: 'failing' | 'running' | 'proposal' | 'no-fix';
  readonly shouldOpenDrawer?: boolean;
  readonly analysisText?: string;
  readonly log?: string;
};

export const checksAnalyzeSeed = ({
  phase,
  shouldOpenDrawer = false,
  analysisText = proposal,
  log: failedLog = log,
}: Params) => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const repo = resolveSessionRepo({ state, sessionId: SESSION_ID });
  const running = Object.values(state.agentTurnState).find((turn) => turn.kind === 'running');
  if (repo === null || running === undefined || running.kind !== 'running') {
    throw new Error('The checks scene needs the seeded branch and running turn.');
  }
  const previous = state.sessionPhaseRuns[SESSION_ID]?.[0];
  if (previous === undefined) {
    throw new Error('The checks scene needs a seeded agent.');
  }
  const agent: Agent = {
    ...previous,
    id: DEBUGGER_ID,
    workflowRunId: undefined,
    stepId: undefined,
    sessionId: SESSION_ID,
    name: ciFixName({ check, pullRequest }),
    kind: 'ci-debugger',
    status: phase === 'running' ? 'running' : 'completed',
    sourceKind: 'failed_check',
    sourceCommentUrl: check.detailsUrl ?? pullRequest.url,
    modelOverride: 'claude-sonnet-5-5',
    providerOverride: 'anthropic',
    effort: 'medium',
    ordinal: 1,
    startedAt: now,
  };
  const kickoff = buildAnalyzeChecksPrompt({
    pullRequest,
    checks: [{ ...check, log: failedLog }],
    paths: ['src/ledger.ts', 'src/ledger.test.ts'],
  });
  const events: ReadonlyArray<TurnEvent> = [
    { kind: 'user_text', runId: running.runId, text: kickoff, at: now },
    {
      kind: 'assistant_text',
      runId: running.runId,
      delta:
        phase === 'proposal'
          ? analysisText
          : phase === 'no-fix'
            ? 'Could not reproduce the failure.'
            : 'Running the retry reproduction in ledger-core.',
      at: now,
    },
  ];
  const github = {
    pr: pullRequest,
    linkedIssues: [],
    fetchedAt: now,
    failedAt: null,
    loading: false,
    error: null,
    detail: {
      prNumber: pullRequest.number,
      comments: [],
      reviews: [],
      reviewRequests: [],
      checks: [
        check,
        { ...check, name: 'payments-api / lint', conclusion: 'success' as const, detailsUrl: null },
      ],
    },
    detailFetchedAt: now,
    detailLoading: false,
    detailError: null,
  };
  useAppStore.setState({
    loadSessionMounts: async () => [],
    sessionPhaseRuns: { [SESSION_ID]: phase === 'failing' ? [] : [agent] },
    agentTurnState:
      phase === 'failing'
        ? {}
        : {
            [agent.id]:
              phase === 'running'
                ? { kind: 'running', runId: running.runId, startedAt: now }
                : { kind: 'ended', endedAt: now },
          },
    transcripts: phase === 'failing' ? {} : { [agent.id]: events },
    sessionGithub: { [SESSION_ID]: github },
    mountGithub: {
      [repo.mountId]: {
        ...github,
        mountId: repo.mountId,
        projectId: repo.projectId,
        branch: repo.branch,
        revision: repo.revision,
        repository: 'harborline/payments-api',
        host: 'github',
        prs: [pullRequest],
        links: [],
      },
    },
    activeLens: { [SESSION_ID]: 'branch' },
    branchTab: { [SESSION_ID]: 'checks' },
    selectedAgentId: {},
    drawer: shouldOpenDrawer
      ? {
          kind: 'check-analysis',
          sessionId: SESSION_ID,
          payload: {
            sessionId: SESSION_ID,
            mountId: repo.mountId,
            checkUrl: check.detailsUrl ?? pullRequest.url,
          },
        }
      : null,
  });
  return { sessionId: SESSION_ID, repo, check, pullRequest, agent, events };
};
