import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import { linearIssueCandidate } from '../../../../../features/integrations/issueCandidateOf';
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

const PICKED = linearIssueCandidate(HBL_412);
const PICKED_SOURCE = issueBriefSource({ candidate: PICKED });
const STARRED_RECORD = linearRecordOf(HBL_377);

const BRIEF = {
  title: BRAND_SESSION.title,
  goal: BRAND_SESSION.goal.replace(`${BRAND_SESSION.title}. `, ''),
  acceptance: [
    'Replaying the same processor event three times posts exactly one credit',
    'ledger-core shows one posting per event id',
    'The 23 accounts from last week reconcile to one credit each',
  ],
};

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'linear_fetch_assigned_issues') {
      return KICKOFF_ASSIGNED;
    }
    throw new Error(`${cmd} is not available in the brand scene`);
  });
};

const seedKickoff = (): void => {
  useAppStore.setState({
    workspaceIntegrations: { [WORKSPACE_ID]: [linearBindingOf({ workspaceId: WORKSPACE_ID })] },
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
