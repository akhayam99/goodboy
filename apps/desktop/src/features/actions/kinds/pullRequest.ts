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
import { PULL_REQUEST_NOUNS, REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { PrMergeMethod, PullRequestState, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { selectActiveProjectPrs } from '../../../store/slices/github/activeProjectPrs';
import { lensPlace } from '../../../store/slices/navigation/canonicalLocation';
import { selectPrWrite } from '../../../store/slices/pr-writes/selectPrWrite';
import {
  sessionPullRequestHostOf,
  sessionPullRequestOf,
} from '../../../store/slices/review-source/sessionPullRequestOf';
import { sessionMountViews } from '../../../store/slices/project-mounts/mountRowModel';
import { refreshActiveRequest } from '../../../store/slices/review-source/refreshActiveRequest';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { isScribeWriting } from '../../../store/slices/scribe/isScribeWriting';
import { SCRIBE_WRITING_REASON } from '../../../store/slices/scribe/scribeWritingReason';
import { describePrWriteInFlight } from '../../review/prLifecycle';
import {
  evaluatePrMergeReadiness,
  mergeIsClear,
  mergeabilityNoteOf,
} from '../../review/prMergeReadiness';
import { FOLLOW_LABEL } from '../../../shared/lib/followToast';
import { isOverlayDrawerOpen } from '../../../shared/hooks/useFollowToast';
import { isTargetShown } from '../../../shared/hooks/useFollowToast/isTargetShown';
import { branchPlace } from '../../../store/slices/navigation/place';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type {
  ActionConfirmOption,
  ActionDefinition,
  ActionEnv,
  ObjectKindDefinition,
  PullRequestActionTarget,
} from '../types';
import {
  ALL_MERGE_METHODS,
  fixSignalsOf,
  pullRequestFacts,
  type PullRequestFacts,
} from './pullRequestFacts';

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

const isLive = ({ facts }: FactsOnly): boolean => facts.phase === 'open' || facts.phase === 'draft';

const isOpenForMerge = ({ facts }: FactsOnly): boolean =>
  facts.phase === 'open' || facts.phase === 'queued';

const hasPr = ({ facts }: FactsOnly): boolean => facts.phase !== 'none';

const nounsOf = ({ facts }: FactsOnly) => PULL_REQUEST_NOUNS[facts.host];

const numberLabel = ({ facts }: FactsOnly): string =>
  facts.number === null
    ? `the ${nounsOf({ facts }).long}`
    : `${nounsOf({ facts }).numberPrefix}${facts.number}`;

const baseOf = ({ facts }: FactsOnly): string => facts.pr?.baseBranch ?? 'the base branch';

const readinessOf = ({ facts }: FactsOnly) => evaluatePrMergeReadiness({ facts });

const mergeBlock = ({ facts }: FactsOnly): string | null =>
  readinessOf({ facts }).blockers[0] ?? null;

const isMergeClear = ({ facts }: FactsOnly): boolean =>
  mergeIsClear({ readiness: readinessOf({ facts }) });

const MERGE_METHOD_LABEL: Readonly<Record<PrMergeMethod, string>> = {
  squash: 'Squash and merge',
  merge: 'Merge commit',
  rebase: 'Rebase and merge',
};

const mergeMethodDetail = ({
  method,
  facts,
}: {
  readonly method: PrMergeMethod;
  readonly facts: PullRequestFacts;
}): string => {
  const base = baseOf({ facts });
  const count = facts.commitCount;
  if (method === 'squash') {
    return `One commit on ${base}`;
  }
  if (method === 'merge') {
    return count === null
      ? 'Every commit and a merge commit'
      : `All ${count} commits and a merge commit`;
  }
  return count === null ? `Commits on top of ${base}` : `${count} commits on top of ${base}`;
};

const mergeOptions = ({
  facts,
}: {
  readonly facts: PullRequestFacts;
}): ReadonlyArray<ActionConfirmOption> =>
  ALL_MERGE_METHODS.map((method) => ({
    id: method,
    label: MERGE_METHOD_LABEL[method],
    detail: mergeMethodDetail({ method, facts }),
    disabledReason: facts.mergeMethods.includes(method)
      ? null
      : (facts.mergeMethodReasons[method] ?? 'Turned off for this repository'),
  }));

const defaultMergeMethod = ({ facts }: { readonly facts: PullRequestFacts }): PrMergeMethod =>
  facts.mergeMethods[0] ?? 'squash';

const mergeLabel = ({ facts }: FactsOnly): string =>
  facts.commentsNeedYou > 0 ? `Merge · ${facts.commentsNeedYou} open` : 'Merge';

const isMergeMethod = (value: string | null): value is PrMergeMethod =>
  value === 'squash' || value === 'merge' || value === 'rebase';

const writeBlock = ({ facts }: FactsOnly): string | null =>
  facts.writeInFlight === null ? null : `${facts.writeInFlight}.`;

const can = ({
  facts,
  capability,
}: {
  readonly facts: PullRequestFacts;
  readonly capability: keyof (typeof REVIEW_SOURCE_CAPABILITIES)['github'];
}): boolean => REVIEW_SOURCE_CAPABILITIES[facts.host][capability];

const hostLabel = ({ facts }: FactsOnly): string => REVIEW_SOURCE_LABEL[facts.host];

const refresh = ({ env, facts }: { readonly env: ActionEnv; readonly facts: PullRequestFacts }) => {
  const state = env.getState();
  void refreshActiveRequest({ get: env.getState, sessionId: facts.sessionId });
  if (facts.host === 'github') {
    void state.refreshSessionPrDetail(facts.sessionId, { force: true });
  }
  void state.loadPullRequestView({ sessionId: facts.sessionId, force: true });
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

const readyToast = ({
  env,
  facts,
}: {
  readonly env: ActionEnv;
  readonly facts: PullRequestFacts;
}): void => {
  const place = branchPlace({ sessionId: facts.sessionId, tab: 'pr' });
  const isShown = isTargetShown({
    state: env.getState(),
    request: place,
    drawer: null,
    isOverlayOpen: isOverlayDrawerOpen(),
  });
  env.showToast({
    kind: 'info',
    title: `Marked ${numberLabel({ facts })} ready for review`,
    message: '',
    ...(!isShown && {
      action: {
        label: FOLLOW_LABEL,
        onClick: () => env.getState().navigate({ to: place }),
      },
    }),
  });
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
  state.navigate({
    to: lensPlace({ state: env.getState(), sessionId: facts.sessionId, lens: 'pr' }),
  });
};

const PULL_REQUEST_ACTIONS: ReadonlyArray<ActionDefinition<PullRequestFacts>> = [
  {
    id: 'pullRequest.openOnGithub',
    label: ({ facts }) => `Open on ${hostLabel({ facts })}`,
    shortLabel: ({ facts }) => hostLabel({ facts }),
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
    id: 'pullRequest.checkLog',
    label: ({ facts }) =>
      facts.checks === 'failing' ? 'Open the failing check log' : 'Open check logs',
    shortLabel: () => 'Open log',
    icon: ScrollText,
    group: 'open',
    when: isLive,
    slot: () => 'hover',
    run: ({ facts }) => {
      const fallback =
        facts.pr === null
          ? null
          : facts.host === 'github'
            ? `${facts.pr.url}/checks`
            : facts.host === 'gitlab'
              ? `${facts.pr.url}/pipelines`
              : facts.pr.url;
      const url = facts.failingLogUrl ?? fallback;
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
    when: ({ facts }) => facts.phase === 'draft' && can({ facts, capability: 'canSetDraft' }),
    blockedReason: writeBlock,
    slot: () => 'primary',
    pendingLabel: () => 'Marking ready…',
    run: async ({ facts, env }) => {
      await write({
        env,
        facts,
        task: ({ number }) => env.getState().markPrReady(facts.sessionId, number),
      });
      readyToast({ env, facts });
    },
  },
  {
    id: 'pullRequest.merge',
    label: 'Merge',
    shortLabel: mergeLabel,
    icon: CONCEPT_ICONS.merge,
    group: 'act',
    when: isOpenForMerge,
    blockedReason: mergeBlock,
    description: ({ facts }) => {
      const readiness = readinessOf({ facts });
      return readiness.blockers.length === 0 && readiness.caveats.length > 0
        ? readiness.word
        : null;
    },
    slot: ({ facts }) => (isMergeClear({ facts }) ? 'primary' : 'secondary'),
    pendingLabel: () => 'Merging…',
    confirm: ({ facts }) => {
      const readiness = readinessOf({ facts });
      return {
        title: `Merge ${numberLabel({ facts })} into ${baseOf({ facts })}?`,
        description:
          readiness.caveats.length > 0
            ? `${readiness.word}. Choose how ${facts.pr?.headBranch ?? 'the branch'} lands on ${baseOf({ facts })}.`
            : `Choose how ${facts.pr?.headBranch ?? 'the branch'} lands on ${baseOf({ facts })}. ${
                mergeabilityNoteOf({ host: facts.host, mergeable: facts.pr?.mergeable ?? null }) ??
                `${hostLabel({ facts })} closes the ${nounsOf({ facts }).long}`
              }.`,
        confirmLabel: readiness.caveats.length > 0 ? 'Merge anyway' : 'Merge',
        role: readiness.caveats.length > 0 ? 'alert' : 'primary',
        choice: {
          label: 'Merge method',
          options: mergeOptions({ facts }),
          defaultId: defaultMergeMethod({ facts }),
        },
      };
    },
    run: async ({ facts, env, choice }) => {
      await write({
        env,
        facts,
        task: ({ number }) =>
          env
            .getState()
            .mergePr(
              facts.sessionId,
              number,
              isMergeMethod(choice) ? choice : defaultMergeMethod({ facts }),
            ),
      });
      env.showToast({
        kind: 'info',
        title: `Merged ${numberLabel({ facts })} into ${baseOf({ facts })}`,
        message: '',
      });
    },
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
    when: ({ facts }) => facts.phase === 'closed' && can({ facts, capability: 'canReopen' }),
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
    when: ({ facts }) =>
      isLive({ facts }) &&
      facts.isOwn &&
      (can({ facts, capability: 'canEditTitle' }) || can({ facts, capability: 'canEditBody' })),
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
    when: ({ facts }) =>
      isLive({ facts }) && facts.isOwn && can({ facts, capability: 'canRequestReviewers' }),
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
    when: ({ facts }) =>
      facts.phase === 'open' && facts.isOwn && can({ facts, capability: 'canSetDraft' }),
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
    when: ({ facts }) => facts.phase === 'none' && facts.host !== 'bitbucket',
    blockedReason: ({ facts }) => (facts.isScribeWriting ? SCRIBE_WRITING_REASON : null),
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
    label: ({ facts }) => `Close ${nounsOf({ facts }).long}`,
    icon: XCircle,
    group: 'danger',
    when: ({ facts }) => isLive({ facts }) && facts.isOwn && can({ facts, capability: 'canClose' }),
    blockedReason: writeBlock,
    pendingLabel: () => 'Closing…',
    confirm: ({ facts }) => ({
      title: `Close ${numberLabel({ facts })} without merging?`,
      description: can({ facts, capability: 'canReopen' })
        ? 'Reviewers see it closed. The branch and its commits stay, and Reopen brings it back.'
        : `Reviewers see it declined. The branch and its commits stay. ${hostLabel({ facts })} can't reopen a declined ${nounsOf({ facts }).long}.`,
      confirmLabel: `Close ${nounsOf({ facts }).long}`,
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
    const requestParams = {
      state,
      sessionId: target.sessionId,
      ...(target.prNumber === null ? {} : { prNumber: target.prNumber }),
    };
    const canonical = sessionPullRequestOf(requestParams);
    const host =
      canonical === null ? (target.host ?? 'github') : sessionPullRequestHostOf(requestParams);
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
    const signals = fixSignalsOf({
      threads: state.sessionResolveThreads?.[target.sessionId] ?? [],
    });
    const entry = state.pullRequestViews?.[target.sessionId] ?? null;
    const view = pr !== null && entry?.prNumber === pr.number ? entry.view : null;
    const portChecks = host !== 'github' && view !== null ? view.checks : null;
    return pullRequestFacts({
      sessionId: target.sessionId,
      host,
      pr,
      checks: detailMatches ? detail.checks : portChecks === null ? null : portChecks.runs,
      checksRead: detailMatches
        ? (detail.checksRead ?? 'ok')
        : portChecks === null || portChecks.read === 'unsupported'
          ? null
          : portChecks.read,
      comments: detailMatches ? detail.comments : [],
      reviews: detailMatches ? detail.reviews : [],
      viewer: host === 'github' ? (state.githubStatus?.user ?? null) : null,
      writeInFlight:
        claim === null || pr === null
          ? null
          : describePrWriteInFlight({
              action: claim.action,
              prNumber: pr.number,
              nouns: PULL_REQUEST_NOUNS[host],
            }),
      isScribeWriting: sessionMountViews({ state, sessionId: target.sessionId }).some((view) =>
        isScribeWriting({ scribeWork: state.scribeWork, mountId: view.id }),
      ),
      ...signals,
      ...(view === null
        ? {}
        : {
            mergeMethods: view.mergeMethods,
            mergeMethodReasons: view.mergeMethodReasons,
            commitCount: view.commits.length,
          }),
    });
  },
  actions: PULL_REQUEST_ACTIONS,
};
