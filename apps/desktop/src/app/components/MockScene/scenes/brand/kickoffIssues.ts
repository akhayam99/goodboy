import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  WorkspaceId,
} from '@goodboy/types';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { BRAND_PEOPLE, BRAND_SESSION, BRAND_WORKSPACE_NAME } from './canon';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const kickoffIsoAgo = (offsetMs: number): IsoDateTime =>
  new Date(Date.now() - offsetMs).toISOString() as IsoDateTime;

const SLUG = BRAND_WORKSPACE_NAME.toLowerCase();

type IssueParams = {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
  readonly state: LinearIssue['state'];
  readonly priority: number;
  readonly priorityLabel: string;
  readonly assignee: string;
  readonly creator: string;
  readonly project: string;
  readonly labels: ReadonlyArray<{ readonly name: string; readonly color: string }>;
  readonly ago: number;
};

const linearIssue = ({
  id,
  identifier,
  title,
  description,
  state,
  priority,
  priorityLabel,
  assignee,
  creator,
  project,
  labels,
  ago,
}: IssueParams): LinearIssue => ({
  id,
  identifier,
  title,
  description,
  url: `https://linear.example.invalid/${SLUG}/issue/${identifier}`,
  state,
  team: { key: 'HBL' },
  priority,
  priorityLabel,
  assignee: { name: assignee },
  creator: { name: creator },
  project: { name: project },
  labels: { nodes: labels },
  updatedAt: kickoffIsoAgo(ago),
});

export const HBL_412: LinearIssue = linearIssue({
  id: 'mock-brand-linear-hbl-412',
  identifier: BRAND_SESSION.issue,
  title: BRAND_SESSION.issueTitle,
  description: [
    'When the processor redelivers a webhook we already acknowledged late, payments-api applies the credit a second time. Support refunded 23 accounts by hand last week.',
    '',
    'Sentry groups every one of them under DuplicateCreditError in applyWebhook. The retries all carry the same event id, so we have what we need to spot them.',
    '',
    'One event id should produce one credit, however many times it arrives.',
  ].join('\n'),
  state: { name: 'Todo', type: 'unstarted' },
  priority: 1,
  priorityLabel: 'Urgent',
  assignee: BRAND_PEOPLE.owner.name,
  creator: BRAND_PEOPLE.reporter.name,
  project: 'Payments',
  labels: [
    { name: 'bug', color: '#eb5757' },
    { name: 'webhooks', color: '#5e6ad2' },
  ],
  ago: 18 * MINUTE,
});

export const HBL_398: LinearIssue = linearIssue({
  id: 'mock-brand-linear-hbl-398',
  identifier: 'HBL-398',
  title: 'Show the retry count on each delivery in notify-relay',
  description:
    'Oncall cannot tell a first delivery from a fifth retry without reading the logs. Put the attempt number on the delivery row.',
  state: { name: 'Todo', type: 'unstarted' },
  priority: 3,
  priorityLabel: 'Medium',
  assignee: BRAND_PEOPLE.owner.name,
  creator: BRAND_PEOPLE.oncall.name,
  project: 'Notifications',
  labels: [{ name: 'oncall', color: '#f2994a' }],
  ago: 3 * HOUR,
});

export const linearBindingOf = ({
  workspaceId,
}: {
  readonly workspaceId: WorkspaceId;
}): IntegrationBinding => ({
  id: 'mock-brand-binding-linear' as IntegrationBindingId,
  workspaceId,
  projectId: null,
  credentialId: 'mock-brand-credential-linear' as IntegrationCredentialId,
  provider: 'linear',
  config: {
    workspaceUrlKey: SLUG,
    viewerUserId: 'mock-brand-linear-viewer',
    viewerName: BRAND_PEOPLE.owner.name,
  },
  createdAt: kickoffIsoAgo(30 * DAY),
  updatedAt: kickoffIsoAgo(DAY),
});
