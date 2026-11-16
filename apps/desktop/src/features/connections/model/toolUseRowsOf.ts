import { GitMerge, Hash, type IconGlyph } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { IntegrationGlyphProvider } from '../../../shared/components/IntegrationGlyph';
import type { InboxKind } from '../../inbox/types';
import type { ToolUse } from '../../../store/slices/integrations/toolUses';

export type ToolUseSource =
  | { readonly kind: 'tasks'; readonly use: ToolUse; readonly inboxKind: InboxKind }
  | { readonly kind: 'channels' };

export type ToolUseRowModel = {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
  readonly icon: IconGlyph;
  readonly source: ToolUseSource;
};

type Params = {
  readonly tool: IntegrationGlyphProvider;
};

type IssuesParams = {
  readonly detail: string;
};

const ASSIGNED = 'Assigned to you';

const issuesRow = ({ detail }: IssuesParams): ToolUseRowModel => ({
  key: 'issues',
  label: 'Issues in Tasks',
  detail,
  icon: CONCEPT_ICONS.inbox,
  source: { kind: 'tasks', use: 'issues', inboxKind: 'issue' },
});

const TOOL_USE_ROWS: Readonly<Record<IntegrationGlyphProvider, ReadonlyArray<ToolUseRowModel>>> = {
  github: [
    {
      key: 'pullRequests',
      label: 'Pull requests',
      detail: 'Opened by you',
      icon: CONCEPT_ICONS.pr,
      source: { kind: 'tasks', use: 'pullRequests', inboxKind: 'pr' },
    },
    {
      key: 'reviews',
      label: 'Reviews waiting on you',
      detail: 'Pull requests that ask for your review',
      icon: CONCEPT_ICONS.decisions,
      source: { kind: 'tasks', use: 'reviews', inboxKind: 'pr' },
    },
    issuesRow({ detail: ASSIGNED }),
  ],
  gitlab: [
    {
      key: 'mergeRequests',
      label: 'Merge requests',
      detail: ASSIGNED,
      icon: GitMerge,
      source: { kind: 'tasks', use: 'mergeRequests', inboxKind: 'mr' },
    },
    issuesRow({ detail: ASSIGNED }),
  ],
  bitbucket: [
    {
      key: 'pullRequests',
      label: 'Pull requests',
      detail: 'Open in the workspace repository',
      icon: CONCEPT_ICONS.pr,
      source: { kind: 'tasks', use: 'pullRequests', inboxKind: 'pr' },
    },
  ],
  linear: [issuesRow({ detail: ASSIGNED })],
  jira: [issuesRow({ detail: ASSIGNED })],
  sentry: [
    {
      ...issuesRow({ detail: 'Unresolved issues' }),
      source: { kind: 'tasks', use: 'issues', inboxKind: 'error' },
    },
  ],
  slack: [
    {
      key: 'channels',
      label: 'Followed channels',
      detail: 'Threads from these channels come to Tasks',
      icon: Hash,
      source: { kind: 'channels' },
    },
    {
      key: 'threads',
      label: 'Threads in Tasks',
      detail: 'Open threads in followed channels',
      icon: CONCEPT_ICONS.inbox,
      source: { kind: 'tasks', use: 'threads', inboxKind: 'thread' },
    },
  ],
};

export const toolUseRowsOf = ({ tool }: Params): ReadonlyArray<ToolUseRowModel> =>
  TOOL_USE_ROWS[tool];
