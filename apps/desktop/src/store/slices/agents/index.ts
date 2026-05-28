import { clearAgentDraft } from './clearAgentDraft';
import { deleteAgent } from './deleteAgent';
import { markAgentViewed } from './markAgentViewed';
import { renameAgent } from './renameAgent';
import { selectAgent } from './selectAgent';
import { setAgentDraft } from './setAgentDraft';
import { setAgentKind } from './setAgentKind';
import { spawnAgent } from './spawnAgent';
import type { GetFn, SetFn } from './types';

export function createAgentsSlice(set: SetFn, get: GetFn) {
  return {
    setAgentKind: setAgentKind(set),
    setAgentDraft: setAgentDraft(set),
    clearAgentDraft: clearAgentDraft(set),
    selectAgent: selectAgent(set, get),
    markAgentViewed: markAgentViewed(set, get),
    renameAgent: renameAgent(set),
    spawnAgent: spawnAgent(set, get),
    deleteAgent: deleteAgent(set, get),
  };
}
