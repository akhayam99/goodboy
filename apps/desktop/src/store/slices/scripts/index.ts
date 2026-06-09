import { cancelScript } from './cancelScript';
import { deleteScript } from './deleteScript';
import { dismissScriptResult } from './dismissScriptResult';
import { loadScripts } from './loadScripts';
import { runScript } from './runScript';
import { runWorkspaceScript } from './runWorkspaceScript';
import { saveScript } from './saveScript';
import type { GetFn, SetFn } from './types';

export const createScriptsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadScripts: loadScripts(set),
    saveScript: saveScript(get),
    deleteScript: deleteScript(set),
    runScript: runScript(set, get),
    cancelScript: cancelScript(set, get),
    runWorkspaceScript: runWorkspaceScript(set, get),
    dismissScriptResult: dismissScriptResult(set),
  };
};
