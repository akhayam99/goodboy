import type { WorkspaceLookup } from '../hooks/useWorkspaceIssueLookup';
import type { InboxRecord } from '../../inbox/types';
import type { LookupFailure } from './classifyLookupError';
import type { LookupProvider, LookupTarget } from './routeIssueCode';

const PROVIDER_LABEL: Readonly<Record<LookupProvider, string>> = {
  linear: 'Linear',
  jira: 'Jira',
  github: 'GitHub',
  gitlab: 'GitLab',
  sentry: 'Sentry',
};

export const targetProvider = (target: LookupTarget): LookupProvider =>
  target.provider === 'sentry-id' ? 'sentry' : target.provider;

type LookupStatusAction =
  | {
      readonly kind: 'open-integrations';
      readonly label: string;
      readonly provider: LookupProvider;
    }
  | { readonly kind: 'retry'; readonly label: string };

export type LookupStatus = {
  readonly key: string;
  readonly tone: 'muted' | 'warning' | 'info';
  readonly text: string;
  readonly action: LookupStatusAction | null;
};

const joinOr = (names: ReadonlyArray<string>): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;

const joinAnd = (names: ReadonlyArray<string>): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

export const lookingUpText = ({
  code,
  providers,
}: {
  readonly code: string;
  readonly providers: ReadonlyArray<LookupProvider>;
}): string => {
  if (providers.length === 0) {
    return `Looking up ${code}`;
  }
  const names = providers.map((provider) => PROVIDER_LABEL[provider]);
  return `Looking up ${code} in ${joinAnd(names)}`;
};

const failureStatus = ({
  code,
  provider,
  failure,
}: {
  readonly code: string;
  readonly provider: LookupProvider;
  readonly failure: LookupFailure;
}): LookupStatus => {
  const name = PROVIDER_LABEL[provider];
  const key = `${provider}:${failure}`;
  switch (failure) {
    case 'not-found':
      return {
        key,
        tone: 'muted',
        text: `${code} isn't in ${name}, or your ${name} key can't see it.`,
        action: null,
      };
    case 'unauthorized':
      return {
        key,
        tone: 'warning',
        text: `${name} stopped accepting your key.`,
        action: { kind: 'open-integrations', label: 'Sign in again', provider },
      };
    case 'forbidden':
      return {
        key,
        tone: 'warning',
        text: `Your ${name} key can't read issues.`,
        action: { kind: 'open-integrations', label: 'Open Integrations', provider },
      };
    case 'rate-limited':
      return {
        key,
        tone: 'warning',
        text: `${name} asked Goodboy to slow down.`,
        action: { kind: 'retry', label: 'Retry' },
      };
    case 'unreachable':
      return {
        key,
        tone: 'warning',
        text: `Couldn't reach ${name}.`,
        action: { kind: 'retry', label: 'Retry' },
      };
  }
};

export const lookupStatuses = ({
  lookup,
  workspaceName,
}: {
  readonly lookup: WorkspaceLookup;
  readonly workspaceName: string;
}): ReadonlyArray<LookupStatus> => {
  const { route, result } = lookup;
  if (route.kind === 'none') {
    return [];
  }
  if (route.kind === 'no-repo') {
    return [
      {
        key: 'no-repo',
        tone: 'info',
        text: `No GitHub or GitLab repository in ${workspaceName} to look up ${route.label}.`,
        action: null,
      },
    ];
  }
  if (route.kind === 'not-connected') {
    const names = route.providers.map((provider) => PROVIDER_LABEL[provider]);
    return [
      {
        key: 'not-connected',
        tone: 'muted',
        text: `${route.label} looks like a ${joinOr(names)} issue. Connect ${names.length > 1 ? 'one' : 'it'} to look it up.`,
        action: null,
      },
    ];
  }
  const failures = new Map<string, LookupStatus>();
  for (const miss of result.misses) {
    const provider = targetProvider(miss.target);
    if (miss.failure === 'not-found' && result.hits.length > 0) {
      continue;
    }
    const status = failureStatus({ code: route.label, provider, failure: miss.failure });
    failures.set(status.key, status);
  }
  const statuses = [...failures.values()];
  const notFound = statuses.filter((status) => status.key.endsWith(':not-found'));
  if (notFound.length <= 1) {
    return statuses;
  }
  const names = [
    ...new Set(
      result.misses
        .filter((miss) => miss.failure === 'not-found')
        .map((miss) => PROVIDER_LABEL[targetProvider(miss.target)]),
    ),
  ];
  return [
    ...statuses.filter((status) => !status.key.endsWith(':not-found')),
    {
      key: 'not-found',
      tone: 'muted',
      text: `${route.label} isn't in ${joinAnd(names)}, or your keys can't see it.`,
      action: null,
    },
  ];
};

export const ISSUE_SEARCH_PLACEHOLDER = 'Search, or paste CAS-231, #482 or a link';

const assigneeNameOf = (record: InboxRecord): string | null => {
  const { payload } = record;
  switch (payload.provider) {
    case 'linear':
      return payload.kind === 'issue' ? (payload.issue.assignee?.name ?? null) : null;
    case 'jira':
      return payload.issue.assignee?.displayName ?? null;
    default:
      return null;
  }
};

export const lookupHitSecondLine = (record: InboxRecord): string => {
  const assignee = assigneeNameOf(record);
  return assignee === null ? record.context : `Assigned to ${assignee}`;
};
