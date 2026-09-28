import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  ProjectSentryLink,
  WorkspaceId,
} from '@goodboy/types';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import {
  linearIssueCandidate,
  sentryIssueCandidate,
} from '../../../../../features/integrations/issueCandidateOf';
import type { SentryIssue } from '../../../../../features/integrations/sentry/client';
import { issueBriefSource } from '../../../../../features/session/components/SessionKickoff/issueBriefSource';
import { issueBriefKey } from '../../../../../store/slices/issue-briefs/issueBriefKey';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStudioChrome } from '../shellChrome';
import { BRAND_MODELS, BRAND_SESSION } from './canon';
import {
  HBL_377,
  HBL_412,
  KICKOFF_ASSIGNED,
  linearBindingOf,
  linearRecordOf,
  starredLinearOf,
} from './kickoffIssues';

const SENTRY_ISSUE: SentryIssue = {
  id: '7001',
  project: { slug: 'payments-api', name: 'payments-api' } as SentryIssue['project'],
  shortId: 'PAYMENTS-API-7K1',
  title: 'DuplicateChargeError: charge already captured for order',
  culprit: 'settle_batch',
  level: 'error',
  status: 'unresolved',
  count: '42',
  userCount: 9,
  firstSeen: '2026-09-25T08:00:00.000Z',
  lastSeen: '2026-09-27T08:52:00.000Z',
  permalink: 'https://harborline.sentry.io/issues/7001/',
  metadata: null,
};

const SENTRY_LINKS: ReadonlyArray<ProjectSentryLink> = [
  {
    projectId: 'mock-board-project-payments-api' as ProjectId,
    sentryProject: 'payments-api',
  } as ProjectSentryLink,
];

const sentryBindingOf = ({
  workspaceId,
}: {
  readonly workspaceId: WorkspaceId;
}): IntegrationBinding => ({
  id: 'mock-brand-binding-sentry' as IntegrationBindingId,
  workspaceId,
  projectId: null,
  credentialId: 'mock-brand-credential-sentry' as IntegrationCredentialId,
  provider: 'sentry',
  config: {
    org: 'harborline',
    project: 'payments-api',
    orgName: 'Harborline',
    projectName: 'payments-api',
  },
  createdAt: '2026-08-28T09:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-26T09:00:00.000Z' as IsoDateTime,
});

const isSentryPick = (): boolean =>
  new URLSearchParams(window.location.search).get('issue') === 'sentry';

const PICKED = isSentryPick() ? sentryIssueCandidate(SENTRY_ISSUE) : linearIssueCandidate(HBL_412);
const PICKED_SOURCE = issueBriefSource({ candidate: PICKED });

const LINEAR_BRIEF = {
  title: BRAND_SESSION.title,
  goal: BRAND_SESSION.goal.replace(`${BRAND_SESSION.title}. `, ''),
  acceptance: [
    'Replaying the same processor event three times posts exactly one credit',
    'ledger-core shows one posting per event id',
    'The 23 accounts from last week reconcile to one credit each',
  ],
};

const SENTRY_BRIEF = {
  title: 'Stop double captures in settle_batch',
  goal: 'settle_batch captures a charge a second time when the processor retries the same order. Make the capture idempotent per order so a retry never charges twice.',
  acceptance: [
    'Replaying the same capture event twice charges the order once',
    'PAYMENTS-API-7K1 stops firing after the fix ships',
  ],
};

const BRIEF = isSentryPick() ? SENTRY_BRIEF : LINEAR_BRIEF;
const STARRED_RECORD = linearRecordOf(HBL_377);

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'linear_fetch_assigned_issues') {
      return KICKOFF_ASSIGNED;
    }
    if (cmd === 'sentry_fetch_issues') {
      return { issues: [SENTRY_ISSUE], next_cursor: null };
    }
    if (cmd === 'sentry_list_code_mappings') {
      return [];
    }
    throw new Error(`${cmd} is not available in the brand scene`);
  });
};

const seedKickoff = (): void => {
  useAppStore.setState({
    workspaceIntegrations: {
      [WORKSPACE_ID]: [
        linearBindingOf({ workspaceId: WORKSPACE_ID }),
        ...(isSentryPick() ? [sentryBindingOf({ workspaceId: WORKSPACE_ID })] : []),
      ],
    },
    projectSentryLinks: { [WORKSPACE_ID]: SENTRY_LINKS },
    sessionExternalTasks: {},
    starredIssues: {
      [WORKSPACE_ID]: [starredLinearOf({ workspaceId: WORKSPACE_ID, issue: HBL_377 })],
    },
    starredRecords: { [WORKSPACE_ID]: { [`linear:${HBL_377.id}`]: STARRED_RECORD } },
    loadStarredIssues: async () => undefined,
    refreshStarredIssues: async () => undefined,
    sessionDrafts: {
      [WORKSPACE_ID]: {
        ...EMPTY_SESSION_DRAFT,
        choice: 'task',
        issueKey: `${PICKED.provider}:${PICKED.externalId}`,
        pickedIssue: PICKED,
      },
    },
    openSessionDraftWorkspaceId: WORKSPACE_ID,
    issueBriefs: {
      [issueBriefKey({ source: PICKED_SOURCE })]: {
        status: 'ready',
        signature: `${PICKED_SOURCE.title}\n${PICKED_SOURCE.body}`,
        route: { providerId: BRAND_MODELS.scout.provider, model: BRAND_MODELS.scout.model },
        brief: BRIEF,
        durationMs: 3_800,
        costUsd: 0.004,
      },
    },
    requestIssueBrief: async () => undefined,
  } as never);
};

export const BrandKickoffScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    seedKickoff();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return <StudioFrame target={null} main={<SessionDraftPane workspaceId={WORKSPACE_ID} />} />;
};
