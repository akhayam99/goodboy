import { mockSceneIpc } from './mockSceneIpc';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import type { LinearIssue } from '../../../../features/integrations/linear/client';
import type { SentryIssue } from '../../../../features/integrations/sentry/client';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const isoAgo = (offsetMs: number): string => new Date(Date.now() - offsetMs).toISOString();

type BindingParams = {
  readonly workspaceId: WorkspaceId;
  readonly now: IsoDateTime;
};

type LinearParams = {
  readonly id: string;
  readonly title: string;
  readonly state: LinearIssue['state'];
  readonly ago: number;
};

type SentryParams = {
  readonly id: string;
  readonly shortId: string;
  readonly title: string;
  readonly culprit: string;
  readonly ago: number;
};

const linearIssue = ({ id, title, state, ago }: LinearParams): LinearIssue => ({
  id: `mock-workspace-linear-${id}`,
  identifier: id,
  title,
  description: null,
  url: `https://example.invalid/linear/${id}`,
  state,
  team: { key: 'NW' },
  project: { name: 'Storefront' },
  updatedAt: isoAgo(ago),
});

const sentryIssue = ({ id, shortId, title, culprit, ago }: SentryParams): SentryIssue => ({
  id,
  project: null,
  shortId,
  title,
  culprit,
  level: 'error',
  status: 'unresolved',
  count: '184',
  userCount: 41,
  firstSeen: isoAgo(3 * DAY),
  lastSeen: isoAgo(ago),
  permalink: `https://example.invalid/sentry/${shortId}`,
  metadata: null,
});

const LINEAR_ISSUES: ReadonlyArray<LinearIssue> = [
  linearIssue({
    id: 'NW-212',
    title: 'Show every mounted project in the session header',
    state: { name: 'In Progress', type: 'started' },
    ago: 25 * MINUTE,
  }),
  linearIssue({
    id: 'NW-207',
    title: 'Scope pull requests to the mounted projects',
    state: { name: 'Todo', type: 'unstarted' },
    ago: 18 * HOUR,
  }),
  linearIssue({
    id: 'NW-198',
    title: 'Checkout retries charge twice',
    state: { name: 'Backlog', type: 'backlog' },
    ago: 4 * DAY,
  }),
];

const SENTRY_ISSUES: ReadonlyArray<SentryIssue> = [
  sentryIssue({
    id: 'mock-workspace-sentry-1',
    shortId: 'STOREFRONT-WEB-4K',
    title: 'TypeError: cannot read properties of undefined (reading mounts)',
    culprit: 'SessionHeader.render',
    ago: 40 * MINUTE,
  }),
  sentryIssue({
    id: 'mock-workspace-sentry-2',
    shortId: 'API-2F',
    title: 'Timeout fetching pull requests for a project',
    culprit: 'prs.list_for_project',
    ago: 13 * HOUR,
  }),
];

export const workspaceTrackerBindings = ({
  workspaceId,
  now,
}: BindingParams): ReadonlyArray<IntegrationBinding> => [
  {
    id: 'mock-workspace-binding-linear' as IntegrationBindingId,
    workspaceId,
    projectId: null,
    credentialId: 'mock-workspace-credential-linear' as IntegrationCredentialId,
    provider: 'linear',
    config: {
      workspaceUrlKey: 'northwind',
      viewerUserId: 'mock-workspace-linear-viewer',
      viewerName: 'Robin V.',
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mock-workspace-binding-sentry' as IntegrationBindingId,
    workspaceId,
    projectId: null,
    credentialId: 'mock-workspace-credential-sentry' as IntegrationCredentialId,
    provider: 'sentry',
    config: { org: 'northwind', project: 'storefront-web' },
    createdAt: now,
    updatedAt: now,
  },
];

export const installWorkspaceInboxIpc = (): void => {
  mockSceneIpc((cmd) => {
    if (cmd === 'linear_fetch_assigned_issues') {
      return LINEAR_ISSUES;
    }
    if (cmd === 'sentry_fetch_issues') {
      return { issues: SENTRY_ISSUES, next_cursor: null };
    }
    throw new Error(`${cmd} is not available in the workspace scene`);
  });
};
