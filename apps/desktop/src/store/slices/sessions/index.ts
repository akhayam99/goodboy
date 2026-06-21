import { archiveTask } from './archiveTask';
import { autoTitleSession } from './autoTitleSession';
import { bulkDeleteTask } from './bulkDeleteTask';
import { bulkUnarchiveTask } from './bulkUnarchiveTask';
import { createSession } from './createSession';
import { deleteTask } from './deleteTask';
import { renameTask } from './renameTask';
import { setAgentConfig } from './setAgentConfig';
import { setAgentVerbosity } from './setAgentVerbosity';
import { setCurrentSession } from './setCurrentSession';
import { setSessionAutoRun } from './setSessionAutoRun';
import { setSessionConfig } from './setSessionConfig';
import { setSessionPermissionMode } from './setSessionPermissionMode';
import { unarchiveTask } from './unarchiveTask';
import type { GetFn, SetFn } from './types';

export const createSessionsSlice = (set: SetFn, get: GetFn) => {
  return {
    renameTask: renameTask(set, get),
    autoTitleSession: autoTitleSession(set, get),
    setSessionConfig: setSessionConfig(set, get),
    setAgentConfig: setAgentConfig(set, get),
    setSessionPermissionMode: setSessionPermissionMode(set),
    setSessionAutoRun: setSessionAutoRun(set, get),
    setAgentVerbosity: setAgentVerbosity(set),
    deleteTask: deleteTask(set, get),
    bulkDeleteTask: bulkDeleteTask(set, get),
    archiveTask: archiveTask(set, get),
    unarchiveTask: unarchiveTask(set, get),
    bulkUnarchiveTask: bulkUnarchiveTask(set, get),
    createSession: createSession(set, get),
    setCurrentSession: setCurrentSession(set, get),
  };
};
