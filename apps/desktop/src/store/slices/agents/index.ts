import { activateNextResolver } from './activateNextResolver';
import { clearAgentAttachments } from './clearAgentAttachments';
import { clearAgentDraft } from './clearAgentDraft';
import { clearAgentQueue } from './clearAgentQueue';
import { deleteAgent } from './deleteAgent';
import { deselectAgent } from './deselectAgent';
import { forceCloseResolver } from './forceCloseResolver';
import { markAgentViewed } from './markAgentViewed';
import { renameAgent } from './renameAgent';
import { selectAgent } from './selectAgent';
import { setAgentAttachments } from './setAgentAttachments';
import { setAgentDraft } from './setAgentDraft';
import { setAgentEffortOverride } from './setAgentEffortOverride';
import { setAgentKind } from './setAgentKind';
import { setAgentQueue } from './setAgentQueue';
import { spawnAgent } from './spawnAgent';
import type { GetFn, SetFn } from './types';

export const createAgentsSlice = (set: SetFn, get: GetFn) => {
  return {
    setAgentKind: setAgentKind(set),
    setAgentEffortOverride: setAgentEffortOverride(set),
    setAgentDraft: setAgentDraft(set),
    clearAgentDraft: clearAgentDraft(set),
    setAgentAttachments: setAgentAttachments(set),
    clearAgentAttachments: clearAgentAttachments(set),
    setAgentQueue: setAgentQueue(set),
    clearAgentQueue: clearAgentQueue(set),
    selectAgent: selectAgent(set, get),
    deselectAgent: deselectAgent(set),
    markAgentViewed: markAgentViewed(set, get),
    renameAgent: renameAgent(set),
    spawnAgent: spawnAgent(set, get),
    deleteAgent: deleteAgent(set, get),
    activateNextResolver: activateNextResolver(set, get),
    forceCloseResolver: forceCloseResolver(set, get),
  };
};
