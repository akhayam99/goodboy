import { getSessionViewPrefs } from './getSessionViewPrefs';
import { createInitialSessionViewState } from './createInitialSessionViewState';
import { setArtifactFilter } from './artifactFilter';
import { closeArtifactConversation, openArtifactConversation } from './artifactConversation';
import { awaitArtifactAgent, openArtifactCreation } from './artifactCreation';
import { markSessionOpened } from './markSessionOpened';
import { setSessionViewPrefs } from './setSessionViewPrefs';
import { setAgentTab } from './setAgentTab';
import { setExploreExpanded } from './setExploreExpanded';
import { setExploreMountPath } from './setExploreMountPath';
import { dismissCheckProposal } from './dismissCheckProposal';
import { setSessionDismissedNextSteps } from './setSessionDismissedNextSteps';
import { toggleSessionGroup } from './toggleSessionGroup';
import {
  openDiffLens,
  openMountDiff,
  openRewriteHistory,
  openMountCommits,
  openMountTerminal,
  openExternalTaskLens,
  setActiveLens,
  setDiffFocus,
  setFocusedArtifactId,
  setFocusedGithubIssueNumber,
  setFocusedWorkflowRun,
} from './workSurface';
import { openResolveDiff, setResolveQueueView } from './resolveSurface';
import { setResolveItemDraft } from './resolveItemDrafts';
import { beginSessionCreation, endSessionCreation } from './sessionCreation';
import type { SessionViewSlice } from './types';
import type { SliceDeps } from '../../slice-types';

export { isPrReviewSession } from './isPrReviewSession';
export { EMPTY_RESOLVE_QUEUE_VIEW } from './types';
export type { SessionViewSlice } from './types';
export type { LensKind, DiffFocus, SessionCreationId } from './types';

export const createSessionViewSlice = ({ set, get }: SliceDeps): SessionViewSlice => {
  return {
    ...createInitialSessionViewState({}),
    setScriptsLensScope: ({ scope }) => set({ scriptsLensScope: scope }),
    getSessionViewPrefs: getSessionViewPrefs(set, get),
    setSessionViewPrefs: setSessionViewPrefs(set, get),
    markSessionOpened: markSessionOpened(set),
    toggleSessionGroup: toggleSessionGroup(set),
    dismissCheckProposal: dismissCheckProposal({ set }),
    setSessionDismissedNextSteps: setSessionDismissedNextSteps({ set }),
    setExploreExpanded: setExploreExpanded(set),
    setExploreMountPath: setExploreMountPath(set),
    setAgentTab: setAgentTab(set),
    setActiveLens: setActiveLens(set),
    setFocusedWorkflowRun: setFocusedWorkflowRun(set),
    setFocusedArtifactId: setFocusedArtifactId(set),
    setArtifactFilter: setArtifactFilter(set),
    openArtifactConversation: openArtifactConversation(set, get),
    closeArtifactConversation: closeArtifactConversation(set),
    openArtifactCreation: openArtifactCreation(set, get),
    awaitArtifactAgent: awaitArtifactAgent(set),
    setFocusedGithubIssueNumber: setFocusedGithubIssueNumber(set),
    setDiffFocus: setDiffFocus(set),
    openDiffLens: openDiffLens(get),
    setResolveQueueView: setResolveQueueView(set),
    openResolveDiff: openResolveDiff(set, get),
    setResolveItemDraft: setResolveItemDraft(set),
    openMountDiff: openMountDiff(get),
    openRewriteHistory: openRewriteHistory(get),
    openMountCommits: openMountCommits(get),
    openMountTerminal: openMountTerminal(get),
    openExternalTaskLens: openExternalTaskLens(get),
    beginSessionCreation: beginSessionCreation(set),
    endSessionCreation: endSessionCreation(set),
  };
};
