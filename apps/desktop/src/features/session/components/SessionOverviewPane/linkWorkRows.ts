import type { SessionExternalTaskProvider } from '@goodboy/types';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';
import { compareIsoDesc } from '../../../../shared/utils/compareIsoDesc';
import type { LinkScope } from './linkScope';
import { resolvePastedIssueCandidate } from '../SessionWorkspace/parts/IntegrationPane/resolvePastedIssueCandidate';

export type LinkWorkSource = SessionExternalTaskProvider | 'all';

export type LinkWorkItem = {
  readonly key: string;
  readonly task: LaunchExternalTask;
  readonly status: string;
  readonly updatedAt: string;
};

export type LinkWorkRow = LinkWorkItem & {
  readonly section: 'inbox' | 'results' | 'paste';
  readonly linkedScopes: ReadonlyArray<LinkScope>;
};

export type LinkedScopes = ReadonlyMap<string, ReadonlyArray<LinkScope>>;

const ALL_SCOPES: ReadonlyArray<LinkScope> = ['session', 'workspace'];

const NO_SCOPES: ReadonlyArray<LinkScope> = [];

export type LinkWorkView =
  | { readonly kind: 'paste'; readonly rows: ReadonlyArray<LinkWorkRow> }
  | { readonly kind: 'unknownLink' }
  | { readonly kind: 'list'; readonly rows: ReadonlyArray<LinkWorkRow> };

export const LINK_WORK_PROVIDER_LABEL: Readonly<Record<SessionExternalTaskProvider, string>> = {
  linear: 'Linear',
  sentry: 'Sentry',
  github: 'GitHub',
  gitlab: 'GitLab',
  jira: 'Jira',
  slack: 'Slack',
  bitbucket: 'Bitbucket',
};

const INBOX_LIMIT = 3;

const RESULT_LIMIT_EMPTY = 5;

const RESULT_LIMIT_QUERY = 8;

const HOST_PROVIDERS: ReadonlyArray<readonly [RegExp, SessionExternalTaskProvider]> = [
  [/(^|\.)linear\.app$/, 'linear'],
  [/sentry/, 'sentry'],
  [/(^|\.)github\.com$/, 'github'],
  [/gitlab/, 'gitlab'],
  [/(^|\.)atlassian\.net$|jira/, 'jira'],
  [/(^|\.)slack\.com$/, 'slack'],
  [/(^|\.)bitbucket\.org$/, 'bitbucket'],
];

type LinkParams = {
  readonly value: string;
};

const isLinkLike = ({ value }: LinkParams): boolean => {
  const trimmed = value.trim();
  if (trimmed.includes('://')) {
    return true;
  }
  const host = trimmed.split('/')[0] ?? '';
  return trimmed.includes('/') && host.includes('.') && !trimmed.includes(' ');
};

const hostOf = ({ value }: LinkParams): string | null => {
  try {
    const trimmed = value.trim();
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const pastedTaskOf = ({ value }: LinkParams): LaunchExternalTask | null => {
  const host = hostOf({ value });
  if (host === null) {
    return null;
  }
  const provider = HOST_PROVIDERS.find(([pattern]) => pattern.test(host))?.[1];
  if (provider === undefined) {
    return null;
  }
  const candidate = resolvePastedIssueCandidate({ provider, rawValue: value });
  if (candidate === null) {
    return null;
  }
  return {
    provider,
    externalId: candidate.externalId,
    identifier: candidate.identifier,
    url: candidate.url,
    title: candidate.title,
  };
};

export const taskKey = ({ task }: { readonly task: LaunchExternalTask }): string =>
  `${task.provider}:${task.externalId}`;

type ViewParams = {
  readonly query: string;
  readonly source: LinkWorkSource;
  readonly items: ReadonlyArray<LinkWorkItem>;
  readonly lookedUp: ReadonlyArray<LinkWorkItem>;
  readonly linkedScopes: LinkedScopes;
};

const matchesQuery = ({
  item,
  words,
}: {
  readonly item: LinkWorkItem;
  readonly words: ReadonlyArray<string>;
}): boolean => {
  const haystack =
    `${item.task.identifier} ${item.task.title} ${LINK_WORK_PROVIDER_LABEL[item.task.provider]}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
};

export const linkWorkView = ({
  query,
  source,
  items,
  lookedUp,
  linkedScopes,
}: ViewParams): LinkWorkView => {
  const scopesOf = (key: string): ReadonlyArray<LinkScope> => linkedScopes.get(key) ?? NO_SCOPES;
  if (isLinkLike({ value: query })) {
    const hit = lookedUp[0];
    if (hit !== undefined) {
      return {
        kind: 'paste',
        rows: [{ ...hit, section: 'paste', linkedScopes: scopesOf(hit.key) }],
      };
    }
    const task = pastedTaskOf({ value: query });
    if (task === null) {
      return { kind: 'unknownLink' };
    }
    const key = taskKey({ task });
    return {
      kind: 'paste',
      rows: [
        { key, task, status: '', updatedAt: '', section: 'paste', linkedScopes: scopesOf(key) },
      ],
    };
  }
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '');
  const fits = (item: LinkWorkItem): boolean =>
    !ALL_SCOPES.every((scope) => scopesOf(item.key).includes(scope)) &&
    (source === 'all' || item.task.provider === source) &&
    matchesQuery({ item, words });
  const recent = [...items]
    .filter(fits)
    .sort(
      (left, right) =>
        compareIsoDesc({ left: left.updatedAt, right: right.updatedAt }) ||
        left.key.localeCompare(right.key),
    );
  const inbox = recent.slice(0, INBOX_LIMIT);
  const inboxKeys = new Set(inbox.map((item) => item.key));
  const extra = lookedUp.filter(
    (item) => fits(item) && !recent.some((candidate) => candidate.key === item.key),
  );
  const results = [...extra, ...recent.filter((item) => !inboxKeys.has(item.key))].slice(
    0,
    words.length > 0 ? RESULT_LIMIT_QUERY : RESULT_LIMIT_EMPTY,
  );
  return {
    kind: 'list',
    rows: [
      ...inbox.map((item): LinkWorkRow => ({
        ...item,
        section: 'inbox',
        linkedScopes: scopesOf(item.key),
      })),
      ...results.map((item): LinkWorkRow => ({
        ...item,
        section: 'results',
        linkedScopes: scopesOf(item.key),
      })),
    ],
  };
};
