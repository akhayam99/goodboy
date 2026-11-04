import { brandId, type ProjectId, type SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { applyMountViews } from '../../../../../store/slices/project-mounts/mountViews';
import {
  BLOCKED_BRANCH_A,
  BLOCKED_MOUNT_A,
  BLOCKED_MOUNT_SESSION_ID,
  seedBlockedMountStep,
} from '../u30/blockedMountStepSeed';

export const ADD_PROJECT_OTHER_ID = brandId<ProjectId>({ value: 'mock-u34-p26-payments-api' });

export const seedAddProject = (): void => {
  seedBlockedMountStep();
  const state = useAppStore.getState();
  const ledger = state.projects[0];
  const missing = (state.sessionMounts[BLOCKED_MOUNT_SESSION_ID] ?? []).find(
    (view) => view.id === BLOCKED_MOUNT_A && view.branch === BLOCKED_BRANCH_A,
  );
  if (ledger === undefined || missing === undefined) {
    throw new Error('The blocked step seed has no ledger-core or no detached branch.');
  }
  const detached: SessionMountView = { ...missing, diskState: 'missing' };
  useAppStore.setState({
    projects: [
      ledger,
      {
        ...ledger,
        id: ADD_PROJECT_OTHER_ID,
        name: 'payments-api',
        rootPath: '~/code/northwind/payments-api',
      },
    ],
    sessionActiveMount: { [BLOCKED_MOUNT_SESSION_ID]: null },
  });
  applyMountViews({
    set: useAppStore.setState,
    sessionId: BLOCKED_MOUNT_SESSION_ID,
    views: [detached],
  });
};
