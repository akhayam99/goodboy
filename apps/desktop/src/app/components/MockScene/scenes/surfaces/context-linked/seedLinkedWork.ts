import { type SessionExternalTask } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { sceneClock } from '../../../sceneClock';

type Params = { readonly isDisconnected?: boolean };

export const seedLinkedWork = ({ isDisconnected = false }: Params) => {
  seedActivityRunScene();
  const clock = sceneClock({ anchor: '2026-11-01T09:00:00.000Z' });
  const createdAt = clock.iso({ at: '2026-11-01T09:00:00.000Z' });
  const tasks: ReadonlyArray<SessionExternalTask> = [
    {
      sessionId: SESSION_ID,
      provider: 'linear',
      externalId: 'HAR-142',
      identifier: 'HAR-142',
      title: 'Keep webhook retries idempotent',
      url: 'https://linear.app/harborline/issue/HAR-142',
      createdAt,
    },
    {
      sessionId: SESSION_ID,
      provider: 'sentry',
      externalId: '142',
      identifier: 'PAYMENTS-42',
      title: 'Duplicate credit on redelivery',
      url: 'https://sentry.io/organizations/harborline/issues/142/',
      createdAt,
    },
    {
      sessionId: SESSION_ID,
      provider: 'slack',
      externalId: 'harborline-thread',
      identifier: '#payments',
      title: 'Confirm the earlier retry rollout',
      url: 'https://harborline.slack.com/archives/payments/p142',
      branch: 'hl/previous-retry-rollout',
      scope: 'branch',
      createdAt,
    },
  ];
  const workspaceId = useAppStore.getState().currentWorkspaceId;
  useAppStore.setState({
    sessionExternalTasks: { [SESSION_ID]: tasks },
    sessionGithub: {},
    ...(isDisconnected && workspaceId !== null
      ? { workspaceIntegrations: { [workspaceId]: [] } }
      : {}),
  });
};
