import { useEffect, useState } from 'react';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  SessionExternalTask,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION } from '../workflowSeed';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';

const clock = sceneClock({ anchor: '2026-10-10T09:00:00.000Z' });

const ISSUE: SessionExternalTask = {
  sessionId: SESSION.id,
  provider: 'linear',
  externalId: 'NW-142',
  identifier: 'NW-142',
  title: 'Retry webhook deliveries on a 502',
  url: 'https://linear.app/northwind/issue/NW-142',
  createdAt: clock.iso({ at: '2026-10-09T09:00:00.000Z' }),
};

const seedIssue = (): void => {
  useAppStore.setState((state) => ({
    sessionExternalTasks: { ...state.sessionExternalTasks, [SESSION.id]: [ISSUE] },
    activeLens: { ...state.activeLens, [SESSION.id]: 'linear' },
    focusedExternalTask: {
      ...state.focusedExternalTask,
      [SESSION.id]: { provider: 'linear', externalId: ISSUE.externalId, projectId: null },
    },
    workspaceIntegrations: {
      ...state.workspaceIntegrations,
      [SESSION.workspaceId]: [
        {
          id: 'mock-binding-linear' as IntegrationBindingId,
          workspaceId: SESSION.workspaceId,
          projectId: null,
          credentialId: 'mock-credential-linear' as IntegrationCredentialId,
          provider: 'linear',
          config: {
            workspaceUrlKey: 'northwind',
            viewerUserId: 'viewer-northwind',
            viewerName: 'Northwind',
          },
          createdAt: clock.iso({ at: '2026-10-01T09:00:00.000Z' }),
          updatedAt: clock.iso({ at: '2026-10-01T09:00:00.000Z' }),
        },
      ],
    },
  }));
};

export const TaskMoveIssueScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context: 'session' });
    seedIssue();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} />;
};
