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

const copyOf = ({ projectName, prNumber, progress }: CopyParams): Copy => {
  if (progress?.chain === 'fixed-pushed' && progress.outcome === 'failed') {
    return {
      title: `${progress.checkName} still fails on #${prNumber}`,
      detail: `${projectName} · the check failed again after the push. Nothing runs by itself.`,
    };
  }
  return {
    title: `Fix failing checks on #${prNumber}`,
    detail: `${projectName} · checks failed`,
  };
};

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
