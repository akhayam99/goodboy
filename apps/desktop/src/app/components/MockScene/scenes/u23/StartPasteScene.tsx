import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type {
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  IsoDateTime,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { NewSessionBridge } from '../../../../../features/session/components/NewSessionBridge';
import { SESSION, WORKSPACE_ID } from '../workflowSeed';
import { seedSessionStart } from '../audit/SessionStartScene';
import { SessionStartMain } from '../audit/SessionStartMain';
import { WorkspaceFrame } from '../audit/WorkspaceFrame';

const PASTED_URL = 'https://github.com/harborline/payments-api/pull/318/files';

const NOW = '2026-10-07T09:00:00.000Z' as IsoDateTime;

const LINEAR_BINDING: IntegrationBinding = {
  id: 'mock-start-binding-linear' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'mock-start-credential-linear' as IntegrationCredentialId,
  provider: 'linear',
  config: {
    workspaceUrlKey: 'harborline',
    viewerUserId: 'user-nadia-p',
    viewerName: 'Nadia Petrov',
  },
  createdAt: NOW,
  updatedAt: NOW,
};

const RAW_PULL_REQUEST = {
  number: 318,
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  baseRefName: 'main',
  headRefName: 'nadia-p/single-credit',
  reviewDecision: null,
  statusCheckRollup: [],
  updatedAt: NOW,
  body: 'One credit per processor event.',
  autoMergeRequest: null,
  headRefOid: '3f2a1b94c7d0e8a6b5f4d3c2b1a09876543210fe',
  mergedAt: null,
  author: { login: 'nadia-p' },
};

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'gh_run') {
      return { stdout: JSON.stringify(RAW_PULL_REQUEST), stderr: '', exitCode: 0 };
    }
    if (cmd === 'linear_fetch_assigned_issues') {
      return [];
    }
    return null;
  });
};

export const StartPasteScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedSessionStart({ choice: 'task', issueQuery: PASTED_URL });
    useAppStore.setState({
      workspaceIntegrations: { [WORKSPACE_ID]: [LINEAR_BINDING] },
      currentSessionId: null,
      openSessionDraftWorkspaceId: WORKSPACE_ID,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <>
      <NewSessionBridge />
      <WorkspaceFrame session={SESSION} main={<SessionStartMain />} />
    </>
  );
};
