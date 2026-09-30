import {
  listStarredIssues,
  starIssue,
  unstarClosedIssues as removeClosedStars,
  unstarIssue as removeStar,
  updateStarredIssueSnapshots,
} from '@goodboy/db';
import type { IsoDateTime, JiraIntegrationConfig, WorkspaceId } from '@goodboy/types';
import { refreshStarredIssues as runRefresh } from '../../../features/integrations/starred/refreshStarredIssues';
import { starredIssueOf, starKey } from '../../../features/integrations/starred/starredIssueOf';
import { tauriDatabase } from '../../../shared/lib/db';
import { starredIssuesInitialState } from './state';
import type { SetFn, StarredIssuesSlice } from './types';
import type { SliceDeps } from '../../slice-types';

const REFRESH_AFTER_MS = 5 * 60 * 1000;

const reload = async (set: SetFn, workspaceId: WorkspaceId): Promise<void> => {
  const issues = await listStarredIssues({ db: tauriDatabase, workspaceId });
  set((state) => ({ starredIssues: { ...state.starredIssues, [workspaceId]: issues } }));
};

export const createStarredIssuesSlice = ({ set, get }: SliceDeps): StarredIssuesSlice => ({
  ...starredIssuesInitialState,
  loadStarredIssues: async ({ workspaceId }) => {
    await reload(set, workspaceId);
  },
  starIssueRecord: async ({ workspaceId, record }) => {
    const issue = starredIssueOf({
      workspaceId,
      record,
      now: new Date().toISOString() as IsoDateTime,
    });
    if (issue === null) {
      return;
    }
    await starIssue({ db: tauriDatabase, issue });
    set((state) => ({
      starredRecords: {
        ...state.starredRecords,
        [workspaceId]: { ...(state.starredRecords[workspaceId] ?? {}), [starKey(issue)]: record },
      },
    }));
    await reload(set, workspaceId);
  },
  unstarIssue: async ({ workspaceId, provider, externalId }) => {
    await removeStar({ db: tauriDatabase, workspaceId, provider, externalId });
    await reload(set, workspaceId);
  },
  unstarClosedIssues: async ({ workspaceId }) => {
    const removed = await removeClosedStars({ db: tauriDatabase, workspaceId });
    await reload(set, workspaceId);
    return removed;
  },
  restoreStarredIssues: async ({ workspaceId, issues }) => {
    for (const issue of issues) {
      await starIssue({ db: tauriDatabase, issue });
    }
    await reload(set, workspaceId);
  },
  refreshStarredIssues: async ({ workspaceId, force = false }) => {
    const last = get().starredRefreshedAt[workspaceId] ?? 0;
    if (!force && Date.now() - last < REFRESH_AFTER_MS) {
      return;
    }
    const issues = get().starredIssues[workspaceId] ?? [];
    if (issues.length === 0) {
      return;
    }
    const bindings = get().workspaceIntegrations[workspaceId] ?? [];
    let gitlabHost: string | null = null;
    let jiraConfig: JiraIntegrationConfig | null = null;
    for (const binding of bindings) {
      if (binding.provider === 'gitlab') {
        gitlabHost = binding.config.host;
      }
      if (binding.provider === 'jira') {
        jiraConfig = binding.config;
      }
    }
    const refreshed = await runRefresh({
      workspaceId,
      issues,
      gitlabHost,
      jiraConfig,
      now: new Date().toISOString() as IsoDateTime,
    });
    await updateStarredIssueSnapshots({ db: tauriDatabase, issues: refreshed.snapshots });
    set((state) => ({
      starredRecords: {
        ...state.starredRecords,
        [workspaceId]: { ...(state.starredRecords[workspaceId] ?? {}), ...refreshed.records },
      },
      starredRefreshedAt: { ...state.starredRefreshedAt, [workspaceId]: Date.now() },
    }));
    await reload(set, workspaceId);
  },
});
