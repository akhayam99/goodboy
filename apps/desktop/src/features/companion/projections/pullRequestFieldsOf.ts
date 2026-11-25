import type { Session } from '@goodboy/types';
import { evaluatePrMergeReadiness, mergeIsClear } from '../../review/prMergeReadiness';
import type {
  CheckRow,
  PullRequestFields,
  PullRequestPhase,
  ReviewRow,
} from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import type { WorkspaceScope } from './workspaceScope';

type Params = {
  readonly scope: WorkspaceScope;
  readonly session: Session;
};

type PhaseParams = {
  readonly state: string;
  readonly isDraft: boolean;
  readonly review: string | null;
};

const pullRequestPhaseOf = ({ state, isDraft, review }: PhaseParams): PullRequestPhase => {
  if (state === 'merged' || state === 'closed' || state === 'queued') {
    return state;
  }
  if (isDraft || state === 'draft') {
    return 'draft';
  }
  return review === 'approved' ? 'approved' : 'open';
};

export const pullRequestFieldsOf = ({ scope, session }: Params): PullRequestFields | null => {
  const facts = scope.pullRequestFacts[session.id];
  if (facts === undefined || facts === null || facts.pr === null) {
    return null;
  }
  const { pr } = facts;
  const readiness = evaluatePrMergeReadiness({ facts });
  const phase = pullRequestPhaseOf({
    state: pr.state,
    isDraft: pr.isDraft,
    review: pr.reviewDecision,
  });
  const headSha = pr.headSha ?? '';
  const checks: ReadonlyArray<CheckRow> = [
    ...facts.failingChecks.map((name): CheckRow => ({
      name,
      state: 'failing',
      mark: { kind: 'state', state: 'failed' },
    })),
    ...(facts.runningChecks > 0
      ? [
          {
            name: `${facts.runningChecks} running`,
            state: 'running',
            mark: { kind: 'state', state: 'running' },
          } satisfies CheckRow,
        ]
      : []),
  ];
  const reviews: ReadonlyArray<ReviewRow> = facts.changesRequestedBy.map((author) => ({
    author,
    words: 'Requested changes',
    mark: { kind: 'state', state: 'alert' },
  }));
  const isMergeable = mergeIsClear({ readiness }) && phase !== 'merged' && phase !== 'closed';
  return {
    workspaceId: scope.workspace.id,
    sessionId: session.id,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    phase,
    headSha,
    baseBranch: pr.baseBranch,
    headBranch: pr.headBranch,
    checks,
    reviews,
    readiness: {
      isMergeable,
      reason: isMergeable ? null : readiness.reason,
      caveats: readiness.caveats,
    },
    methods: facts.mergeMethods,
    mergeActionId: isMergeable
      ? actionIdOf({ kind: 'mergePr', objectId: String(pr.number), version: headSha })
      : null,
    train: null,
  };
};
