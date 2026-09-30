import {
  ExternalLink,
  GitBranch,
  GitPullRequestCreate,
  GitPullRequestDraft,
  Link,
  PencilLine,
  RotateCcw,
  ScrollText,
  Send,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { selectActiveProjectPrs } from '../../../store/slices/github/activeProjectPrs';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { selectPrWrite } from '../../../store/slices/pr-writes/selectPrWrite';
import { sessionMountViews } from '../../../store/slices/project-mounts/mountRowModel';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { isPrDraftAgentRunning } from '../../integrations/github/prDraftAgent';
import { describePrWriteInFlight } from '../../review/prLifecycle';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type {
  ActionDefinition,
  ActionEnv,
  ObjectKindDefinition,
  PullRequestActionTarget,
} from '../types';
import { pullRequestFacts, type PullRequestFacts } from './pullRequestFacts';

type FactsOnly = { readonly facts: PullRequestFacts };

export const PR_EDIT_DETAILS_EVENT = 'goodboy:pr-edit-details';
export const PR_REQUEST_REVIEW_EVENT = 'goodboy:pr-request-review';

export const pullRequestEventName = ({
  name,
  sessionId,
}: {
  readonly name: string;
  readonly sessionId: SessionId;
}): string => `${name}:${sessionId}`;

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}): string => `${count} ${count === 1 ? one : many}`;

const isLive = ({ facts }: FactsOnly): boolean => facts.phase === 'open' || facts.phase === 'draft';

const isOpenForMerge = ({ facts }: FactsOnly): boolean =>
  facts.phase === 'open' || facts.phase === 'queued';

const hasPr = ({ facts }: FactsOnly): boolean => facts.phase !== 'none';

const numberLabel = ({ facts }: FactsOnly): string =>
  facts.number === null ? 'the pull request' : `#${facts.number}`;

const baseOf = ({ facts }: FactsOnly): string => facts.pr?.baseBranch ?? 'the base branch';

const mergeBlock = ({ facts }: FactsOnly): string | null => {
  if (facts.writeInFlight !== null) {
    return `${facts.writeInFlight}.`;
  }
  if (facts.phase === 'queued') {
    return 'GitHub is already set to merge this pull request.';
  }
  if (facts.hasConflicts) {
    return `Conflicts with ${baseOf({ facts })}. Rebase in the Diff.`;
  }
  if (facts.checks === 'failing') {
    const count = Math.max(facts.failingChecks.length, 1);
    const names = facts.failingChecks.length > 0 ? `: ${facts.failingChecks.join(', ')}` : '';
    return `${plural({ count, one: 'check', many: 'checks' })} failing${names}.`;
  }
  if (facts.checks === 'pending') {
    return facts.runningChecks > 0
      ? `${plural({ count: facts.runningChecks, one: 'check', many: 'checks' })} still running.`
      : 'Checks are still running.';
  }
  if (facts.review === 'changes_requested') {
    return facts.changesRequestedBy.length > 0
      ? `${facts.changesRequestedBy.join(', ')} asked for changes.`
      : 'A reviewer asked for changes.';
  }
  if (facts.review === 'review_required') {
    return 'Needs an approving review.';
  }
  return null;
};

const writeBlock = ({ facts }: FactsOnly): string | null =>
  facts.writeInFlight === null ? null : `${facts.writeInFlight}.`;

const refresh = ({ env, facts }: { readonly env: ActionEnv; readonly facts: PullRequestFacts }) => {
  const state = env.getState();
  void state.refreshSessionPr(facts.sessionId, { force: true });
  void state.refreshSessionPrDetail(facts.sessionId, { force: true });
};

const write = async ({
  env,
  facts,
  task,
}: {
  readonly env: ActionEnv;
  readonly facts: PullRequestFacts;
  readonly task: (params: { readonly number: number }) => Promise<void>;
}): Promise<void> => {
  if (facts.number === null) {
    return;
  }
  await task({ number: facts.number });
  refresh({ env, facts });
};

const openPrLens = ({
  env,
  facts,
  mode,
}: {
  readonly env: ActionEnv;
  readonly facts: PullRequestFacts;
  readonly mode: 'overview' | 'write_review' | 'create_pr';
}): void => {
  const state = env.getState();
  state.setPullRequestMode({ sessionId: facts.sessionId, mode });
  state.navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'pr' }) });
};

const PULL_REQUEST_ACTIONS: ReadonlyArray<ActionDefinition<PullRequestFacts>> = [
  {
    id: 'pullRequest.openOnGithub',
    label: 'Open on GitHub',
    shortLabel: () => 'GitHub',
    icon: ExternalLink,
    group: 'open',
    when: hasPr,
    slot: () => 'secondary',
    run: ({ facts }) => {
      if (facts.pr !== null) {
        void openUrl(facts.pr.url);
      }
    },
  },
  {
    id: 'pullRequest.openReview',
    label: 'Open Review',
    shortLabel: ({ facts }) =>
      `${plural({ count: facts.openComments, one: 'comment', many: 'comments' })} to resolve`,
    icon: CONCEPT_ICONS.review,
    group: 'open',
    shortcut: 'lens.review',
    when: ({ facts }) => facts.openComments > 0 && isLive({ facts }),
    slot: () => 'nudge',
    run: ({ facts, env }) => {
      void env.getState().openReviewTarget({ sessionId: facts.sessionId });
    },
  },
  {
    id: 'pullRequest.openDiff',
    label: 'Open diff',
    shortLabel: ({ facts }) =>
      facts.hasConflicts ? `Conflicts with ${baseOf({ facts })}` : 'Changes on this branch',
    icon: CONCEPT_ICONS.diff,
    group: 'open',
    shortcut: 'lens.files',
    when: hasPr,
    slot: () => 'nudge',
    run: ({ facts, env }) =>
      env.getState().navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'files' }) }),
  },
  {
    id: 'pullRequest.checkLog',
    label: ({ facts }) =>
      facts.checks === 'failing' ? 'Open the failing check log' : 'Open check logs',
    shortLabel: () => 'Open log',
    icon: ScrollText,
    group: 'open',
    when: isLive,
    slot: () => 'hover',
    run: ({ facts }) => {
      const url = facts.failingLogUrl ?? (facts.pr === null ? null : `${facts.pr.url}/checks`);
      if (url !== null) {
        void openUrl(url);
      }
    },
  },
  {
    id: 'pullRequest.markReady',
    label: 'Mark ready for review',
    shortLabel: () => 'Mark ready',
    icon: Send,
    group: 'act',
    when: ({ facts }) => facts.phase === 'draft',
    blockedReason: writeBlock,
    slot: () => 'primary',
    pendingLabel: () => 'Marking ready…',
    run: ({ facts, env }) =>
      write({
        env,
        facts,
        task: ({ number }) => env.getState().markPrReady(facts.sessionId, number),
      }),
  },
  {
    id: 'pullRequest.merge',
    label: 'Squash and merge',
    icon: CONCEPT_ICONS.merge,
    group: 'act',
    when: isOpenForMerge,
    blockedReason: mergeBlock,
    slot: ({ facts }) => (mergeBlock({ facts }) === null ? 'primary' : 'secondary'),
    pendingLabel: () => 'Merging…',
    confirm: ({ facts }) => ({
      title: `Squash and merge ${numberLabel({ facts })} into ${baseOf({ facts })}?`,
      description: `Every commit on ${facts.pr?.headBranch ?? 'the branch'} lands on ${baseOf({ facts })} as one, and GitHub closes the pull request.`,
      confirmLabel: 'Squash and merge',
      role: 'primary',
    }),
    run: ({ facts, env }) =>
      write({
        env,
        facts,
        task: ({ number }) => env.getState().mergePr(facts.sessionId, number, 'squash'),
      }),
  },
  {
    id: 'pullRequest.writeReview',
    label: 'Write review',
    icon: PencilLine,
    group: 'act',
    when: ({ facts }) => facts.phase === 'open' && !facts.isOwn,
    slot: () => 'secondary',
    run: ({ facts, env }) => openPrLens({ env, facts, mode: 'write_review' }),
  },
  {
    id: 'pullRequest.reopen',
    label: 'Reopen',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.phase === 'closed',
    blockedReason: writeBlock,
    slot: () => 'secondary',
    pendingLabel: () => 'Reopening…',
    run: ({ facts, env }) =>
      write({
        env,
        facts,
        task: ({ number }) => env.getState().reopenPr(facts.sessionId, number),
      }),
  },
  {
    id: 'pullRequest.editDetails',
    label: 'Edit title and description',
    icon: PencilLine,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isOwn,
    slot: () => 'hover',
    run: ({ facts, env }) => {
      openPrLens({ env, facts, mode: 'overview' });
      dispatchAfterNavigation({
        name: pullRequestEventName({ name: PR_EDIT_DETAILS_EVENT, sessionId: facts.sessionId }),
      });
    },
  },
  {
    id: 'pullRequest.requestReview',
    label: 'Request review…',
    icon: UserPlus,
    group: 'act',
    when: ({ facts }) => isLive({ facts }) && facts.isOwn,
    slot: () => 'section',
    run: ({ facts, env }) => {
      openPrLens({ env, facts, mode: 'overview' });
      dispatchAfterNavigation({
        name: pullRequestEventName({ name: PR_REQUEST_REVIEW_EVENT, sessionId: facts.sessionId }),
      });
    },
  },
  {
    id: 'pullRequest.convertToDraft',
    label: 'Convert to draft',
    icon: GitPullRequestDraft,
    group: 'act',
    when: ({ facts }) => facts.phase === 'open' && facts.isOwn,
    blockedReason: writeBlock,
    pendingLabel: () => 'Converting…',
    run: ({ facts, env }) =>
      write({
        env,
        facts,
        task: ({ number }) => env.getState().convertPrToDraft(facts.sessionId, number),
      }),
  },
  {
    id: 'pullRequest.create',
    label: 'Create pull request',
    icon: GitPullRequestCreate,
    group: 'act',
    when: ({ facts }) => facts.phase === 'none',
    blockedReason: ({ facts }) =>
      facts.isDraftAgentRunning ? 'An agent is already drafting the pull request.' : null,
    slot: () => 'primary',
    run: ({ facts, env }) => openPrLens({ env, facts, mode: 'create_pr' }),
  },
  {
    id: 'pullRequest.copyLink',
    label: 'Copy link',
    icon: Link,
    group: 'copy',
    when: hasPr,
    run: ({ facts, env }) => env.copyText({ text: facts.pr?.url ?? '' }),
  },
  {
    id: 'pullRequest.copyBranch',
    label: 'Copy branch name',
    icon: GitBranch,
    group: 'copy',
    when: hasPr,
    run: ({ facts, env }) => env.copyText({ text: facts.pr?.headBranch ?? '' }),
  },
  {
    id: 'pullRequest.close',
    label: 'Close pull request',
    icon: XCircle,
    group: 'danger',
    when: ({ facts }) => isLive({ facts }) && facts.isOwn,
    blockedReason: writeBlock,
    pendingLabel: () => 'Closing…',
    confirm: ({ facts }) => ({
      title: `Close ${numberLabel({ facts })} without merging?`,
      description:
        'Reviewers see it closed. The branch and its commits stay, and Reopen brings it back.',
      confirmLabel: 'Close pull request',
      role: 'danger',
    }),
    run: ({ facts, env }) =>
      write({
        env,
        facts,
        task: ({ number }) => env.getState().closePr(facts.sessionId, number),
      }),
  },
];

const findPr = ({
  prs,
  number,
}: {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly number: number;
}): PullRequestState | null => prs.find((candidate) => candidate.number === number) ?? null;

export const PULL_REQUEST_KIND: ObjectKindDefinition<PullRequestActionTarget, PullRequestFacts> = {
  noun: 'pull request',
  facts: ({ state, target }) => {
    const github = state.sessionGithub[target.sessionId] ?? null;
    const canonical = github?.pr ?? null;
    const candidates = selectActiveProjectPrs({ state, sessionId: target.sessionId });
    const pr =
      target.prNumber === null
        ? canonical
        : (findPr({ prs: candidates, number: target.prNumber }) ??
          (canonical?.number === target.prNumber ? canonical : null));
    const detail =
      pr === null
        ? null
        : ([
            github?.detail ?? null,
            ...sessionMountViews({ state, sessionId: target.sessionId }).map(
              (view) => state.mountGithub[view.id]?.detail ?? null,
            ),
          ].find((candidate) => candidate !== null && candidate.prNumber === pr.number) ?? null);
    const detailMatches = detail !== null;
    const repo = resolveSessionRepo({ state, sessionId: target.sessionId });
    const claim =
      pr === null || repo === null
        ? null
        : selectPrWrite({ state, target: { projectId: repo.projectId, prNumber: pr.number } });
    const agents = state.sessionPhaseRuns[target.sessionId] ?? null;
    return pullRequestFacts({
      sessionId: target.sessionId,
      pr,
      checks: detailMatches ? detail.checks : null,
      comments: detailMatches ? detail.comments : [],
      reviews: detailMatches ? detail.reviews : [],
      viewer: state.githubStatus?.user ?? null,
      writeInFlight:
        claim === null || pr === null
          ? null
          : describePrWriteInFlight({ action: claim.action, prNumber: pr.number }),
      isDraftAgentRunning: agents === null ? false : isPrDraftAgentRunning({ agents }),
    });
  },
  actions: PULL_REQUEST_ACTIONS,
};
