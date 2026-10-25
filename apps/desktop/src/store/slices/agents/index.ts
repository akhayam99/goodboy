import { clearAgentAttachments } from './clearAgentAttachments';
import { clearAgentDone } from './clearAgentDone';
import { clearAgentDraft } from './clearAgentDraft';
import { deleteAgent } from './deleteAgent';
import { forceCloseResolver } from './forceCloseResolver';
import { markAgentSeen } from './markAgentSeen';
import { markAgentUnviewed } from './markAgentUnviewed';
import { markAgentViewed } from './markAgentViewed';
import { markAllAgentsSeen } from './markAllAgentsSeen';
import { markSessionUnread } from './markSessionUnread';
import { markSessionsRead } from './markSessionsRead';
import { renameAgent } from './renameAgent';
import { selectAgent } from './selectAgent';
import { setAgentAttachments } from './setAgentAttachments';
import { setAgentDraft } from './setAgentDraft';
import { setAgentDone } from './setAgentDone';
import { setAgentEffortOverride } from './setAgentEffortOverride';
import { spawnAgent } from './spawnAgent';
import { startFollowUp } from './startFollowUp';
import type { SliceDeps } from '../../slice-types';

export const createAgentsSlice = ({ set, get }: SliceDeps) => {
  return {
    setAgentEffortOverride: setAgentEffortOverride(set),
    setAgentDraft: setAgentDraft(set),
    clearAgentDraft: clearAgentDraft(set),
    setAgentAttachments: setAgentAttachments(set),
    clearAgentAttachments: clearAgentAttachments(set),
    selectAgent: selectAgent(set, get),
    loadAgentTranscript: selectAgent(set, get),
    markAgentViewed: markAgentViewed(set, get),
    markAgentSeen: markAgentSeen(set, get),
    markAgentUnviewed: markAgentUnviewed({ set, get }),
    markAllAgentsSeen: markAllAgentsSeen(set, get),
    markSessionUnread: markSessionUnread({ get }),
    markSessionsRead: markSessionsRead({ get }),
    setAgentDone: setAgentDone(set, get),
    clearAgentDone: clearAgentDone(set, get),
    renameAgent: renameAgent(set),
    spawnAgent: spawnAgent(set, get),
    startFollowUp: startFollowUp(get),
    deleteAgent: deleteAgent(set, get),
    forceCloseResolver: forceCloseResolver(set, get),
  };
};
