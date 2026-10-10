import { useEffect, useState, type ComponentType } from 'react';
import type {
  IntegrationBindingId,
  IntegrationCredentialId,
  SessionExternalTask,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION } from '../workflowSeed';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { RailOrderScene } from './RailOrderScene';

const clock = sceneClock({ anchor: '2026-10-09T09:00:00.000Z' });

const taskOf = ({
  identifier,
  title,
}: {
  readonly identifier: string;
  readonly title: string;
}): SessionExternalTask => ({
  sessionId: SESSION.id,
  provider: 'linear',
  externalId: identifier,
  identifier,
  title,
  url: `https://linear.app/northwind/issue/${identifier}`,
  createdAt: clock.iso({ at: '2026-10-08T09:00:00.000Z' }),
});

const seedLinearIssue = (): void => {
  const sessionId: SessionId = SESSION.id;
  const first = taskOf({ identifier: 'NW-142', title: 'Retry webhook deliveries on a 502' });
  const second = taskOf({
    identifier: 'NW-143',
    title: 'Surface retry counts in the delivery log',
  });
  useAppStore.setState((state) => ({
    sessionExternalTasks: { ...state.sessionExternalTasks, [sessionId]: [first, second] },
    activeLens: { ...state.activeLens, [sessionId]: 'linear' },
    focusedExternalTask: {
      ...state.focusedExternalTask,
      [sessionId]: { provider: 'linear', externalId: first.externalId, projectId: null },
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

const IssueFocused = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context: 'session' });
    seedLinearIssue();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} />;
};

export const U24_P_NAV_SCENES: Readonly<Record<string, ComponentType>> = {
  'integration-issue-focused': IssueFocused,
  railorder: RailOrderScene,
};
