import { bridge, type BridgeArgs } from './harness';

export type GhChecksMode = 'denied' | 'runs';

export type GhBridgeArgs = BridgeArgs & { readonly args?: ReadonlyArray<string> };

const SAML_STDERR =
  'HTTP 403: Resource protected by organization SAML enforcement. You must grant your token access to this organization.';

const EMPTY_THREADS = {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
      },
    },
  },
};

const REVIEWS = {
  reviews: [
    {
      id: 11,
      author: { login: 'kenji-w' },
      authorAssociation: 'MEMBER',
      body: 'Looks right to me.',
      state: 'APPROVED',
      submittedAt: '2026-09-04T11:00:00Z',
    },
  ],
};

const REVIEW_REQUESTS = { reviewRequests: [{ login: 'mara-l', avatarUrl: null }] };

const ROLLUP = {
  statusCheckRollup: [
    {
      name: 'unit tests',
      status: 'COMPLETED',
      conclusion: 'FAILURE',
      detailsUrl: 'https://example.invalid/harborline/payments-api/actions/runs/3',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: '2026-09-04T10:01:36Z',
    },
    {
      name: 'lint',
      status: 'IN_PROGRESS',
      conclusion: null,
      detailsUrl: null,
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: null,
    },
    {
      name: 'build',
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
      detailsUrl: 'https://example.invalid/harborline/payments-api/actions/runs/1',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: '2026-09-04T10:01:34Z',
    },
  ],
};

let mode: GhChecksMode = 'denied';

export const setGhChecksMode = ({ next }: { readonly next: GhChecksMode }): void => {
  mode = next;
};

const ok = ({ value }: { readonly value: unknown }) =>
  Promise.resolve({ stdout: JSON.stringify(value), stderr: '', exitCode: 0 });

const rollup = () =>
  mode === 'denied'
    ? Promise.resolve({ stdout: '', stderr: SAML_STDERR, exitCode: 1 })
    : ok({ value: ROLLUP });

const prViewField = ({ args }: { readonly args: ReadonlyArray<string> }): string =>
  args[args.indexOf('--json') + 1] ?? '';

export const checksBridge = (command: string, payload?: GhBridgeArgs): Promise<unknown> => {
  if (command !== 'gh_run') {
    return bridge(command, payload);
  }
  const args = payload?.args ?? [];
  if (args[0] === 'api' && args[1] === 'graphql') {
    return ok({ value: EMPTY_THREADS });
  }
  if (args[0] === 'api' && args.some((arg) => arg.endsWith('/comments'))) {
    return ok({ value: [] });
  }
  if (args[0] === 'pr' && args[1] === 'view') {
    const field = prViewField({ args });
    if (field === 'reviews') {
      return ok({ value: REVIEWS });
    }
    if (field === 'reviewRequests') {
      return ok({ value: REVIEW_REQUESTS });
    }
    if (field === 'statusCheckRollup') {
      return rollup();
    }
  }
  return bridge(command, payload);
};
