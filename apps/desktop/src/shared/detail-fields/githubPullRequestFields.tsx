import { AlertCircle, CheckCheck, CircleDashed, GitBranch, ListChecks } from 'lucide-react';
import type { PrCheckRun, PullRequestState } from '@goodboy/types';
import { RecordState } from '../components/StudioDetail/RecordState';
import { pullRequestKindOf } from '../pullRequestKind';
import { PULL_REQUEST_PRESENTATION } from '../pullRequestPresentation';
import type { InboxState } from '../../features/inbox/types';
import type { FactRegistry } from './factTypes';

export type GithubPullRequestFacts = {
  readonly pr: Pick<
    PullRequestState,
    'state' | 'isDraft' | 'headBranch' | 'baseBranch' | 'reviewDecision'
  >;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

type Decision = NonNullable<PullRequestState['reviewDecision']>;

const DECISION = {
  approved: { label: 'Approved', icon: CheckCheck },
  changes_requested: { label: 'Changes requested', icon: AlertCircle },
  review_required: { label: 'Review required', icon: CircleDashed },
} satisfies Record<Decision, { readonly label: string; readonly icon: typeof CheckCheck }>;

type CategoryParams = {
  readonly pr: GithubPullRequestFacts['pr'];
};

const githubPullRequestCategory = ({ pr }: CategoryParams): InboxState => {
  const kind = pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft });
  if (kind === 'draft') {
    return 'open';
  }
  if (kind === 'merged' || kind === 'closed') {
    return 'done';
  }
  return 'active';
};

type ChecksParams = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const checksPassing = ({ checks }: ChecksParams): string | null => {
  if (checks.length === 0) {
    return null;
  }
  const passed = checks.filter((check) => check.conclusion === 'success').length;
  return `${passed} of ${checks.length} passing`;
};

export const githubPullRequestFields: FactRegistry<GithubPullRequestFacts> = {
  state: ({ entity }) => ({
    key: 'state',
    label: 'Status',
    icon: null,
    node: (
      <RecordState
        category={githubPullRequestCategory({ pr: entity.pr })}
        label={
          PULL_REQUEST_PRESENTATION[
            pullRequestKindOf({ state: entity.pr.state, isDraft: entity.pr.isDraft })
          ].label
        }
      />
    ),
  }),
  weight: ({ entity }) => {
    const decision = entity.pr.reviewDecision;
    if (decision == null) {
      return null;
    }
    const { label, icon } = DECISION[decision];
    return { key: 'review', label: 'Review', icon, node: label };
  },
  place: ({ entity }) => ({
    key: 'branch',
    label: 'Branch',
    icon: GitBranch,
    node: <span className="font-mono">{`${entity.pr.headBranch} › ${entity.pr.baseBranch}`}</span>,
  }),
  measure: ({ entity }) => ({
    key: 'checks',
    label: 'Checks',
    icon: ListChecks,
    node: checksPassing({ checks: entity.checks }),
  }),
};
