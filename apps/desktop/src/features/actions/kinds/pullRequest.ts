import {
  ArrowUpRight,
  GitBranch,
  GitMerge,
  GitPullRequestDraft,
  Link,
  Plus,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import type { PullRequestState } from '@goodboy/types';
import { openUrl } from '../../../shared/lib/editor';
import type { PrMergeReadiness } from '../../review/prMergeReadiness';
import type { ObjectKindDefinition, PullRequestActionTarget } from '../types';

export type PullRequestFacts = {
  readonly number: number;
  readonly state: PullRequestState['state'];
  readonly isDraft: boolean;
  readonly url: string;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly mergeReadiness: PrMergeReadiness;
  readonly writeInFlight: string | null;
  readonly isBusy: boolean;
  readonly canCreateNew: boolean;
  readonly onMerge: () => Promise<void>;
  readonly onMarkReady: () => void;
  readonly onConvertDraft: () => void;
  readonly onClose: () => void;
  readonly onReopen: () => void;
  readonly onCreateNew: () => void;
};

const BUSY_REASON = 'Another change to this pull request is still running';

type FactsOnly = { readonly facts: PullRequestFacts };

const busyReason = ({ facts }: FactsOnly): string | null =>
  facts.writeInFlight ?? (facts.isBusy ? BUSY_REASON : null);

const isTerminal = ({ facts }: FactsOnly): boolean =>
  facts.state === 'merged' || facts.state === 'closed';

export const PULL_REQUEST_KIND: ObjectKindDefinition<PullRequestActionTarget, PullRequestFacts> = {
  noun: 'pull request',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'pullRequest.openOnGithub',
      label: 'Open on GitHub',
      icon: ArrowUpRight,
      group: 'open',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts }) => openUrl(facts.url),
    },
    {
      id: 'pullRequest.merge',
      label: 'Merge',
      icon: GitMerge,
      group: 'act',
      when: () => true,
      description: ({ facts }) =>
        facts.mergeReadiness.status === 'blocked' ? null : facts.mergeReadiness.reason,
      blockedReason: ({ facts }) =>
        busyReason({ facts }) ??
        (facts.mergeReadiness.status === 'blocked' ? facts.mergeReadiness.reason : null),
      confirm: ({ facts }) => ({
        title: `Squash merge #${facts.number}?`,
        description: `Every commit on ${facts.headBranch} lands on ${facts.baseBranch} as one, and GitHub closes the pull request. The branch is not deleted.`,
        notes:
          facts.mergeReadiness.status === 'ready' && facts.mergeReadiness.caveats.length === 0
            ? []
            : [facts.mergeReadiness.reason, ...facts.mergeReadiness.caveats],
        confirmLabel: 'Confirm merge',
        role: 'danger',
      }),
      run: ({ facts }) => facts.onMerge(),
    },
    {
      id: 'pullRequest.markReady',
      label: 'Mark ready',
      icon: Send,
      group: 'act',
      when: ({ facts }) => !isTerminal({ facts }) && facts.isDraft,
      blockedReason: busyReason,
      confirm: ({ facts }) => ({
        title: `Mark #${facts.number} ready for review?`,
        description:
          'GitHub takes the pull request out of draft and asks the reviewers the repository assigns. That request cannot be unsent.',
        confirmLabel: 'Mark ready',
        role: 'alert',
      }),
      run: ({ facts }) => facts.onMarkReady(),
    },
    {
      id: 'pullRequest.convertDraft',
      label: 'Convert to draft',
      icon: GitPullRequestDraft,
      group: 'act',
      when: ({ facts }) => !isTerminal({ facts }) && !facts.isDraft,
      blockedReason: busyReason,
      run: ({ facts }) => facts.onConvertDraft(),
    },
    {
      id: 'pullRequest.reopen',
      label: 'Reopen',
      icon: RotateCcw,
      group: 'act',
      when: ({ facts }) => facts.state === 'closed',
      blockedReason: busyReason,
      run: ({ facts }) => facts.onReopen(),
    },
    {
      id: 'pullRequest.createNew',
      label: 'Create new PR',
      icon: Plus,
      group: 'act',
      when: () => true,
      description: ({ facts }) =>
        facts.canCreateNew ? 'Open a new pull request for this branch' : null,
      blockedReason: ({ facts }) =>
        busyReason({ facts }) ??
        (facts.canCreateNew ? null : 'An agent is already opening a pull request for this session'),
      run: ({ facts }) => facts.onCreateNew(),
    },
    {
      id: 'pullRequest.copyLink',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.url }),
    },
    {
      id: 'pullRequest.copyBranch',
      label: 'Copy branch name',
      icon: GitBranch,
      group: 'copy',
      when: ({ facts }) => facts.headBranch !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.headBranch }),
    },
    {
      id: 'pullRequest.close',
      label: 'Close',
      icon: XCircle,
      group: 'danger',
      when: ({ facts }) => !isTerminal({ facts }),
      blockedReason: busyReason,
      confirm: ({ facts }) => ({
        title: `Close #${facts.number} without merging?`,
        description:
          'GitHub closes the pull request and drops the review in progress. The branch and its commits stay, and Reopen brings it back.',
        confirmLabel: 'Close it',
        role: 'danger',
      }),
      run: ({ facts }) => facts.onClose(),
    },
  ],
};
