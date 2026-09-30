import { getSessionViewPrefs } from './getSessionViewPrefs';
import { createInitialSessionViewState } from './createInitialSessionViewState';
import { setArtifactFilter } from './artifactFilter';
import { closeArtifactConversation, openArtifactConversation } from './artifactConversation';
import { closeArtifactCreation, openArtifactCreation } from './artifactCreation';
import { setSessionGroup } from './setSessionGroup';
import { setSessionSort } from './setSessionSort';
import { toggleSessionGroup } from './toggleSessionGroup';
import {
  openDiffLens,
  openMountDiff,
  openRewriteHistory,
  closeRewriteHistory,
  openMountTerminal,
  openExternalTaskLens,
  setActiveLens,
  setDiffFocus,
  setFocusedArtifactId,
  setFocusedGithubIssueNumber,
  setFocusedWorkflowRun,
  setSessionStudio,
  toggleWorkflowExpand,
} from './workSurface';
import { openResolveDiff, setResolveQueueView } from './resolveSurface';
import { setResolveItemDraft } from './resolveItemDrafts';
import { beginSessionCreation, endSessionCreation } from './sessionCreation';
import { revealActivityRow } from './revealActivityRow';
import type { SessionViewSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export { isPrReviewSession } from './isPrReviewSession';
export { EMPTY_RESOLVE_QUEUE_VIEW } from './types';
export type { SessionViewSlice } from './types';
export type {
  SessionStudio,
  LensKind,
  DiffFocus,
  ResolveQueueView,
  SessionCreationId,
} from './types';

export const createSessionViewSlice = ({ set, get }: SliceDeps): SessionViewSlice => {
  return {
    ...createInitialSessionViewState({}),
    setScriptsLensScope: ({ scope }) => set({ scriptsLensScope: scope }),
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionSort: setSessionSort(set, get),
    setSessionGroup: setSessionGroup(set, get),
    toggleSessionGroup: toggleSessionGroup(set),
    setActiveLens: setActiveLens(set),
    toggleWorkflowExpand: toggleWorkflowExpand(set),
    setFocusedWorkflowRun: setFocusedWorkflowRun(set),
    setFocusedArtifactId: setFocusedArtifactId(set),
    setArtifactFilter: setArtifactFilter(set),
    openArtifactConversation: openArtifactConversation(set, get),
    closeArtifactConversation: closeArtifactConversation(set),
    openArtifactCreation: openArtifactCreation(set, get),
    closeArtifactCreation: closeArtifactCreation(set),
    setFocusedGithubIssueNumber: setFocusedGithubIssueNumber(set),
    setSessionStudio: setSessionStudio(set),
    setDiffFocus: setDiffFocus(set),
    openDiffLens: openDiffLens(get),
    setResolveQueueView: setResolveQueueView(set),
    openResolveDiff: openResolveDiff(set, get),
    setResolveItemDraft: setResolveItemDraft(set),
    openMountDiff: openMountDiff(get),
    openRewriteHistory: openRewriteHistory(get),
    closeRewriteHistory: closeRewriteHistory(get),
    openMountTerminal: openMountTerminal(get),
    openExternalTaskLens: openExternalTaskLens(get),
    beginSessionCreation: beginSessionCreation(set),
    endSessionCreation: endSessionCreation(set),
    revealActivityRow: revealActivityRow(set),
  };
};
