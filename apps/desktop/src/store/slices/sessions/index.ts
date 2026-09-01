import type { WorkspaceId } from '@goodboy/types';
import { archiveTask } from './archiveTask';
import { autoTitleSession } from './autoTitleSession';
import { bulkArchiveTask } from './bulkArchiveTask';
import { bulkDeleteTask } from './bulkDeleteTask';
import { bulkUnarchiveTask } from './bulkUnarchiveTask';
import { createSession } from './createSession';
import { createUntitledSession } from './createUntitledSession';
import { deleteTask } from './deleteTask';
import { evictSession } from './evictSession';
import { linkSessionExternalTask } from './linkSessionExternalTask';
import { materializeProject } from './materializeProject';
import { renameTask } from './renameTask';
import { setAgentConfig } from './setAgentConfig';
import { setAgentVerbosity } from './setAgentVerbosity';
import { setCurrentSession } from './setCurrentSession';
import { setSessionConfig } from './setSessionConfig';
import { setSessionPermissionMode } from './setSessionPermissionMode';
import { unarchiveTask } from './unarchiveTask';
import { unlinkSessionExternalTask } from './unlinkSessionExternalTask';
import type { GetFn, SetFn } from './types';

export const createSessionsSlice = (set: SetFn, get: GetFn) => {
  return {
    evictSession: evictSession({ set, get }),
    renameTask: renameTask(set, get),
    autoTitleSession: autoTitleSession(set, get),
    setSessionConfig: setSessionConfig(set, get),
    setAgentConfig: setAgentConfig(set, get),
    setSessionPermissionMode: setSessionPermissionMode(set),
    setAgentVerbosity: setAgentVerbosity(set),
    deleteTask: deleteTask(set, get),
    bulkDeleteTask: bulkDeleteTask(set, get),
    archiveTask: archiveTask(set, get),
    bulkArchiveTask: bulkArchiveTask(set, get),
    unarchiveTask: unarchiveTask(set, get),
    bulkUnarchiveTask: bulkUnarchiveTask(set, get),
    createSession: createSession(set, get),
    createUntitledSession: createUntitledSession(set, get),
    clearPendingTitleFocus: () => set({ pendingTitleFocusSessionId: null }),
    materializeProject: materializeProject(set, get),
    linkSessionExternalTask: linkSessionExternalTask({ set, get }),
    unlinkSessionExternalTask: unlinkSessionExternalTask({ set, get }),
    setCurrentSession: setCurrentSession(set, get),
  };
};
