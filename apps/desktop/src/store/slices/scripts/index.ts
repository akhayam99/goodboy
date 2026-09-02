import { cancelScript } from './cancelScript';
import { deleteScript } from './deleteScript';
import { loadDiscoveredScripts } from './loadDiscoveredScripts';
import { loadScripts } from './loadScripts';
import { reattachScriptRuns } from './reattachScriptRuns';
import { refreshDiscoveredScripts } from './refreshDiscoveredScripts';
import { runDiscoveredScript } from './runDiscoveredScript';
import { runScript } from './runScript';
import { saveScript } from './saveScript';
import type { GetFn, SetFn } from './types';

export const createScriptsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadScripts: loadScripts(set, get),
    saveScript: saveScript(get),
    deleteScript: deleteScript(set),
    loadDiscoveredScripts: loadDiscoveredScripts(set, get),
    refreshDiscoveredScripts: refreshDiscoveredScripts(set, get),
    runScript: runScript(set, get),
    runDiscoveredScript: runDiscoveredScript(set, get),
    reattachScriptRuns: reattachScriptRuns(set, get),
    cancelScript: cancelScript(set, get),
  };
};
