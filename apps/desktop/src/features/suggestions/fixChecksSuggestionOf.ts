import type { MountId, PullRequestState, SessionId } from '@goodboy/types';
import type { FixChecksProgress, SessionSuggestion } from './types';

type FixChecksSuggestion = Extract<SessionSuggestion, { readonly kind: 'fix-checks' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectName: string;
  readonly pr: PullRequestState;
  readonly progress: FixChecksProgress | null;
};

type CopyParams = {
  readonly projectName: string;
  readonly prNumber: number;
  readonly progress: FixChecksProgress | null;
};

type Copy = {
  readonly title: string;
  readonly detail: string;
};

type CountParams = {
  readonly count: number;
};

type ProgressParams = {
  readonly progress: FixChecksProgress | null;
};

const commitsLabel = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'commit' : 'commits'}`;

const readyDetail = ({ count }: CountParams): string =>
  count === 1
    ? '1 commit is ready. Push it so the check runs again.'
    : `${count} commits are ready. Push them so the check runs again.`;

const copyOf = ({ projectName, prNumber, progress }: CopyParams): Copy => {
  const generic = {
    title: `Fix failing checks on #${prNumber}`,
    detail: `${projectName} · checks failed`,
  };
  if (progress === null) {
    return generic;
  }
  const { checkName, chain, commitCount } = progress;
  switch (chain) {
    case 'analyzing':
      return {
        title: `Analyzing ${checkName} on #${prNumber}`,
        detail: `${projectName} · reading the failed log`,
      };
    case 'fixing':
      return {
        title: `Fixing ${checkName} on #${prNumber}`,
        detail: `${projectName} · applying the proposed fix`,
      };
    case 'fixed-local':
      return {
        title: `${checkName} is fixed on your branch`,
        detail: readyDetail({ count: commitCount }),
      };
    case 'fixed-pushed':
      if (progress.outcome === 'passed') {
        return {
          title: `${checkName} passed on #${prNumber}`,
          detail: `${projectName} · the fix worked. This clears by itself in a while.`,
        };
      }
      if (progress.outcome === 'failed') {
        return {
          title: `${checkName} still fails on #${prNumber}`,
          detail: `${projectName} · the check failed again after the push. Nothing runs by itself.`,
        };
      }
      return {
        title: `${checkName} is running again on #${prNumber}`,
        detail: `${projectName} · ${commitsLabel({ count: commitCount })} pushed`,
      };
    case 'fix-failed':
      return { ...generic, detail: `${projectName} · the fix ended without a commit` };
    case 'none':
    case 'proposal':
    case 'no-fix':
      return generic;
    default: {
      const exhaustive: never = chain;
      return exhaustive;
    }
  }
};

export const isFixInProgress = ({ progress }: ProgressParams): boolean =>
  progress?.chain === 'analyzing' || progress?.chain === 'fixing';

export const fixChecksSuggestionOf = ({
  sessionId,
  mountId,
  projectName,
  pr,
  progress,
}: Params): FixChecksSuggestion => {
  const stage =
    progress === null || progress.chain === 'none' || progress.chain === 'proposal'
      ? ''
      : `:${progress.chain}${progress.outcome === null ? '' : `:${progress.outcome}`}`;
  const { title, detail } = copyOf({ projectName, prNumber: pr.number, progress });
  return {
    id: `fix-checks:${mountId}`,
    kind: 'fix-checks',
    priority: 12,
    band: 1,
    title,
    detail,
    sessionId,
    targetKey: `pr:${mountId}`,
    fingerprint: `fix-checks:${mountId}:${pr.number}${stage}`,
    payload: {
      mountId,
      projectName,
      prNumber: pr.number,
      ...(progress !== null && { progress }),
    },
  };
};
