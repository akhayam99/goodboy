import { brandId, type MountId, type SessionId, type SessionProjectMount } from '@goodboy/types';
import { BRAND_PROJECTS } from '../../scenes/brand/canon';
import { GUARD_BRANCH, TESTS_BRANCH } from './autoStory';
import { storyMountOf } from './storyMountOf';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
};

const RELAY = 'notify-relay';

export const installStoryWorld = ({ store, sessionId }: Params): void => {
  store.setState((current) => {
    const mounts = current.sessionProjectMounts[sessionId] ?? [];
    const payments = mounts.find((mount) => mount.mountName === BRAND_PROJECTS.payments.name);
    const relay = mounts.find((mount) => mount.mountName === RELAY);
    if (payments === undefined || relay === undefined) {
      return {};
    }
    const next: ReadonlyArray<SessionProjectMount> = [
      storyMountOf({
        mount: payments,
        name: BRAND_PROJECTS.payments.name,
        branch: GUARD_BRANCH,
        index: 0,
      }),
      storyMountOf({
        mount: {
          ...payments,
          mountId: brandId<MountId>({ value: `demo-mount-tests-${sessionId}` }),
        },
        name: BRAND_PROJECTS.payments.name,
        branch: TESTS_BRANCH,
        index: 1,
      }),
      storyMountOf({
        mount: relay,
        name: BRAND_PROJECTS.ledger.name,
        branch: GUARD_BRANCH,
        index: 0,
      }),
    ];
    const entry = current.sessionGithub[sessionId];
    return {
      projects: current.projects.map((project) =>
        project.id === relay.projectId
          ? {
              ...project,
              name: BRAND_PROJECTS.ledger.name,
              rootPath: BRAND_PROJECTS.ledger.rootPath,
            }
          : project,
      ),
      sessionProjectMounts: { ...current.sessionProjectMounts, [sessionId]: next },
      sessionActiveMount: { ...current.sessionActiveMount, [sessionId]: payments.mountId },
      sessionWorktrees: {
        ...current.sessionWorktrees,
        [sessionId]: next.map((mount) => mount.worktreePath),
      },
      sessionExternalTasks: {
        ...current.sessionExternalTasks,
        [sessionId]: (current.sessionExternalTasks[sessionId] ?? []).map((task) =>
          task.provider === 'sentry' ? { ...task, identifier: 'PAYMENTS-API-4F2' } : task,
        ),
      },
      sessionGithub: {
        ...current.sessionGithub,
        ...(entry === undefined ? {} : { [sessionId]: { ...entry, linkedIssues: [], pr: null } }),
      },
      mountGithub: {},
      sessionProjectPrs: { ...current.sessionProjectPrs, [sessionId]: {} },
      sessionEvents: {
        ...current.sessionEvents,
        [sessionId]: (current.sessionEvents[sessionId] ?? []).filter(
          (event) => event.kind !== 'pr_created' && event.kind !== 'pr_merged',
        ),
      },
    };
  });
};
