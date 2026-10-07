import type { PrCheckRun, PrDetail, PrReview, PrReviewRequest } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { SessionGithubState } from '../../../../../store/types';
import { seedResolveGitlabScene } from '../resolveGitlabSeed';
import { NOW_ISO, RESOLVE_SCENE_PR, SESSION_ID, seedResolveScene } from '../resolveSeed';

export type ChecksVariant =
  'runs' | 'failing' | 'denied' | 'empty' | 'no-pr' | 'gitlab' | 'loading';

const SAML_LINE =
  'HTTP 403: Resource protected by organization SAML enforcement. You must grant your token access to this organization.';

const run = ({
  name,
  conclusion,
  durationMs = null,
}: {
  readonly name: string;
  readonly conclusion: PrCheckRun['conclusion'];
  readonly durationMs?: number | null;
}): PrCheckRun => ({
  name,
  conclusion,
  durationMs,
  detailsUrl: `https://example.invalid/harborline/payments-api/actions/runs/${encodeURIComponent(name)}`,
});

const PASSING: ReadonlyArray<PrCheckRun> = [
  run({ name: 'build', conclusion: 'success', durationMs: 94_000 }),
  run({ name: 'lint', conclusion: 'success', durationMs: 31_000 }),
  run({ name: 'types', conclusion: 'success', durationMs: 48_000 }),
  run({ name: 'unit tests (api)', conclusion: 'success', durationMs: 212_000 }),
  run({ name: 'unit tests (webhooks)', conclusion: 'success', durationMs: 187_000 }),
  run({ name: 'contract tests', conclusion: 'success', durationMs: 141_000 }),
  run({ name: 'migrations dry run', conclusion: 'success', durationMs: 26_000 }),
  run({ name: 'docs preview', conclusion: 'skipped' }),
];

const FAILING: ReadonlyArray<PrCheckRun> = [
  run({ name: 'unit tests (webhooks)', conclusion: 'failure', durationMs: 96_000 }),
  run({ name: 'contract tests', conclusion: 'timed_out', durationMs: 600_000 }),
  run({ name: 'integration tests', conclusion: 'pending' }),
  ...PASSING.filter(
    (check) => check.name !== 'unit tests (webhooks)' && check.name !== 'contract tests',
  ),
];

const REVIEWS: ReadonlyArray<PrReview> = [
  {
    id: 'review-1',
    author: 'kenji-w',
    authorAvatarUrl: null,
    state: 'commented',
    submittedAt: '2026-09-04T11:00:00Z',
    body: 'Cap the retries at three.',
  },
];

const REQUESTS: ReadonlyArray<PrReviewRequest> = [
  { login: 'mara-l', avatarUrl: null, kind: 'user' },
];

const detailFor = ({
  base,
  patch,
}: {
  readonly base: PrDetail | null;
  readonly patch: Partial<PrDetail>;
}): PrDetail => ({
  prNumber: RESOLVE_SCENE_PR.number,
  comments: base?.comments ?? [],
  reviews: REVIEWS,
  reviewRequests: REQUESTS,
  checks: [],
  checksRead: 'ok',
  checksError: null,
  reviewsRead: 'ok',
  reviewsError: null,
  reviewRequestsRead: 'ok',
  reviewRequestsError: null,
  ...patch,
});

type Github = Pick<SessionGithubState, 'pr' | 'detail'>;

type GithubParams = {
  readonly variant: ChecksVariant;
  readonly current: SessionGithubState;
};

const githubFor = ({ variant, current }: GithubParams): Github => {
  const base = current.detail;
  switch (variant) {
    case 'runs':
      return {
        pr: { ...RESOLVE_SCENE_PR, checks: 'success' },
        detail: detailFor({ base, patch: { checks: PASSING } }),
      };
    case 'failing':
      return {
        pr: { ...RESOLVE_SCENE_PR, checks: 'failure' },
        detail: detailFor({ base, patch: { checks: FAILING } }),
      };
    case 'denied':
      return {
        pr: { ...RESOLVE_SCENE_PR, checks: null, checksUnknown: true },
        detail: detailFor({ base, patch: { checksRead: 'denied', checksError: SAML_LINE } }),
      };
    case 'empty':
      return {
        pr: { ...RESOLVE_SCENE_PR, checks: null },
        detail: detailFor({ base, patch: {} }),
      };
    case 'no-pr':
      return { pr: null, detail: null };
    case 'loading':
      return { pr: RESOLVE_SCENE_PR, detail: null };
    case 'gitlab':
      return { pr: current.pr, detail: current.detail };
    default: {
      const unexpectedVariant: never = variant;
      return unexpectedVariant;
    }
  }
};

export const applyChecksSeed = ({ variant }: { readonly variant: ChecksVariant }): void => {
  if (variant === 'gitlab') {
    seedResolveGitlabScene({ selected: 'gitlab' });
  } else {
    seedResolveScene({ expandedThreadId: null });
  }
  useAppStore.setState((state) => {
    const current = state.sessionGithub[SESSION_ID];
    if (current === undefined) {
      return state;
    }
    const github = githubFor({ variant, current });
    return {
      branchTab: { ...state.branchTab, [SESSION_ID]: 'checks' },
      refreshSessionPrDetail: async () => undefined,
      sessionGithub: {
        ...state.sessionGithub,
        [SESSION_ID]: {
          ...current,
          ...github,
          detailFetchedAt: github.detail === null ? null : NOW_ISO,
          detailLoading: variant === 'loading',
          detailError: null,
        },
      },
    };
  });
};
