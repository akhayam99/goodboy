import { CHECK_STATE } from '../notifications/errorRecovery';
import { browserTabCommands } from './browserTabCommands';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { WorkspaceParams } from './types';

export const loadWorkspaceTabs = ({ set, get }: SliceDeps) => {
  const read = async ({ workspaceId }: WorkspaceParams): Promise<void> => {
    const claimed = browserWrites.loads.claim({
      key: browserWrites.workspaceLoadKey({ workspaceId }),
    });
    const asked = get();
    try {
      const rows = await browserTabCommands.listWorkspace({ workspaceId });
      if (!claimed.isCurrent()) {
        return;
      }
      set((state) => {
        const browserSessionTabs = { ...state.browserSessionTabs };
        const browserActiveTab = { ...state.browserActiveTab };
        for (const session of state.sessions) {
          const isUntouched =
            session.workspaceId === workspaceId &&
            state.browserSessionTabs[session.id] === asked.browserSessionTabs[session.id];
          if (!isUntouched) {
            continue;
          }
          const tabs = rows.filter((row) => row.sessionId === session.id);
          const active = state.browserActiveTab[session.id] ?? null;
          const isKept = active !== null && tabs.some((tab) => tab.id === active);
          browserSessionTabs[session.id] = tabs;
          browserActiveTab[session.id] = isKept ? active : (tabs[0]?.id ?? null);
        }
        const browserProjectPins = { ...state.browserProjectPins };
        for (const project of state.projects) {
          const isUntouched =
            project.workspaceId === workspaceId &&
            state.browserProjectPins[project.id] === asked.browserProjectPins[project.id];
          if (isUntouched) {
            browserProjectPins[project.id] = rows.filter((row) => row.projectId === project.id);
          }
        }
        return {
          browserSessionTabs,
          browserActiveTab,
          browserProjectPins,
          browserTabCounts: { ...state.browserTabCounts, [workspaceId]: 0 },
        };
      });
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load the browser tabs",
        error,
        workspaceId,
      });
    }
  };

  return ({ workspaceId }: WorkspaceParams): Promise<void> => {
    const key = browserWrites.workspaceLoadKey({ workspaceId });
    const running = browserWrites.workspaceReads.get(key);
    if (running !== undefined) {
      return running;
    }
    const started = read({ workspaceId }).finally(() => {
      browserWrites.workspaceReads.delete(key);
    });
    browserWrites.workspaceReads.set(key, started);
    return started;
  };
};
