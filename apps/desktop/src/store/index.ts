export { useAppStore, type ProviderSpendEntry } from './store';

export { agentHasUnread } from './slices/agents/agentHasUnread';
export {
  useNonResolverStandaloneAgents,
  useSessionHasUnread,
  useSessionLastTurnFinishedAt,
} from './slices/agents/selectors';
export { useDiffComments } from './slices/diff-comments/selectors';
export { useRunningHere } from './slices/live-work/selectors';
export {
  useSessionOpenQuestions,
  useSessionAnsweredQuestions,
  useSessionDismissedQuestions,
} from './slices/open-questions/selectors';
export { useSessionPlans } from './slices/plans/selectors';
export { useSessionPrFetchState } from './slices/github/selectors';
export { useMountDiffStats, type MountDiffStat } from './slices/project-mounts/useMountDiffStats';
export { useProjectMountsForSessions } from './slices/project-mounts/useProjectMountsForSessions';
export {
  useSessionStageInfo,
  useSessionStages,
  useSessionViewPrefs,
  useSortedGroupedSessions,
  useStageGroupedSessions,
  useWorkspaceRollup,
} from './slices/session-view/selectors';
export { useDormantSpend } from './slices/dormant-spend/selectors';
export {
  useProjectFilteredSessions,
  useSelectedProjectIds,
} from './slices/sessionFilters/selectors';
export {
  useCurrentSession,
  useExecutedAgentRouting,
  useIsSessionCollectionLoaded,
  useRunSpendUsd,
  useSessionById,
  useSessionCost,
  useSessionLoading,
  useSessions,
  useTelemetryForSessions,
} from './slices/sessions/selectors';
export { useHasUnreadElsewhere, useWorkspaceHasUnread } from './slices/sidebar/selectors';
export { useSessionSlackDrafts } from './slices/slack-drafts/selectors';
export {
  useSessionSlots,
  useSessionSlotsLoad,
  useSlotHistory,
  useSlotHistoryCount,
} from './slices/slots/selectors';
export { useSummarizerStatus } from './slices/summaries/selectors';
export {
  useCurrentWorkspace,
  useDisconnectedWorkspaces,
  useWorkspaces,
} from './slices/workspaces/selectors';
export { useTranscript } from './slices/transcripts/selectors';
export type { SessionStudio, LensKind, DiffFocus } from './slices/session-view';
export { NO_PROJECT_FILTER_ID } from './slices/sessionFilters';
export { BOARD_PLACE, agentPlace, sessionPlace } from './slices/navigation/place';
export type { Location as NavigationLocation } from './slices/navigation/types';
export type { InboxStudioFocus, StudioKind, StudioPlace } from './slices/navigation/studio';

export const EMPTY_ARRAY: readonly never[] = [];
