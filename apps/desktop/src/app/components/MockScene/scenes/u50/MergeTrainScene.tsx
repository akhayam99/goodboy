import { useEffect } from 'react';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type PullRequestState,
  type SessionId,
  type SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { MountGithubState } from '../../../../../store/types';
import type { MergeTrain } from '../../../../../store/slices/pr-series/mergeTrain';
import { QueueScene } from './QueueScene';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isRunning: boolean;
};

type Car = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly number: number;
  readonly title: string;
  readonly branch: string;
};

const CARS: ReadonlyArray<Car> = [
  {
    sessionId: brandId<SessionId>({ value: 'mock-board-session-admin-pagination' }),
    mountId: brandId<MountId>({ value: 'mock-train-mount-76' }),
    number: 76,
    title: 'Retry budget for notify-relay webhooks',
    branch: 'hl/retry-budget',
  },
  {
    sessionId: brandId<SessionId>({ value: 'mock-board-session-reconciliation-export' }),
    mountId: brandId<MountId>({ value: 'mock-train-mount-305' }),
    number: 305,
    title: 'Back off notify-relay deliveries per tenant',
    branch: 'hl/tenant-backoff',
  },
];

const NOTIFY_SESSION = brandId<SessionId>({ value: 'mock-board-session-notify-backoff' });

type CarParams = {
  readonly car: Car;
};

const UPDATED_AT = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

const pullRequestOf = ({ car }: CarParams): PullRequestState => ({
  number: car.number,
  title: car.title,
  url: `https://example.invalid/harborline/notify-relay/pull/${car.number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: car.branch,
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: UPDATED_AT,
});

const GITHUB_REST = {
  linkedIssues: [],
  fetchedAt: UPDATED_AT,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

const RUNNING_TRAIN: Omit<MergeTrain, 'cars'> = {
  id: 'mock-train',
  method: 'squash',
  index: 1,
  step: 'waiting',
  hasUpdated: true,
  merged: 1,
  isStopRequested: false,
  outcome: null,
};

const seedTrain = ({ isRunning }: Pick<Props, 'isRunning'>): void => {
  const state = useAppStore.getState();
  const projectId = state.sessionProjectMounts[NOTIFY_SESSION]?.[0]?.projectId;
  if (projectId === undefined) {
    return;
  }
  const mountOf = ({ car }: CarParams): SessionProjectMount => ({
    mountId: car.mountId,
    sessionId: car.sessionId,
    projectId,
    mountName: 'notify-relay',
    worktreePath: `/work/notify-relay/${car.number}`,
    lastWorktreePath: null,
    repoRoot: '/work/notify-relay',
    branch: car.branch,
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  });
  const githubOf = ({ car }: CarParams): MountGithubState => ({
    ...GITHUB_REST,
    mountId: car.mountId,
    projectId,
    revision: 1,
    repository: null,
    host: null,
    branch: car.branch,
    prs: [],
    links: [],
    pr: pullRequestOf({ car }),
  });
  useAppStore.setState((current) => ({
    sessionProjectMounts: {
      ...current.sessionProjectMounts,
      ...Object.fromEntries(CARS.map((car) => [car.sessionId, [mountOf({ car })]])),
    },
    mountGithub: {
      ...current.mountGithub,
      ...Object.fromEntries(CARS.map((car) => [car.mountId, githubOf({ car })])),
    },
    sessionGithub: {
      ...current.sessionGithub,
      ...Object.fromEntries(
        CARS.map((car) => [car.sessionId, { ...GITHUB_REST, pr: pullRequestOf({ car }) }]),
      ),
    },
    mergeTrain: isRunning
      ? {
          ...RUNNING_TRAIN,
          cars: CARS.map((car) => ({
            sessionId: car.sessionId,
            mountId: car.mountId,
            prNumber: car.number,
            repo: 'notify-relay',
            base: 'main',
          })),
        }
      : null,
  }));
};

export const MergeTrainScene = ({ theme, isRunning }: Props) => {
  useEffect(() => {
    seedTrain({ isRunning });
  }, [isRunning]);
  return <QueueScene theme={theme} isClear={false} />;
};
