export { useAppStore, type ProviderSpendEntry } from './store';
export type { BootPhase } from './types';

export {
  agentHasUnread,
  useCurrentSession,
  useCurrentWorkspace,
  useDiffComments,
  useFilesTouched,
  useSessionLastTurnFinishedAt,
  useMountDiffStats,
  useSessionAnsweredQuestions,
  useSessionById,
  useSessionCost,
  useSessionLoading,
  useIsSessionCollectionLoaded,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useExecutedAgentRouting,
  useRunSpendUsd,
  useSessionPrFetchState,
  useSessionSlots,
  useSessionSlotsLoad,
  useSessionStageInfo,
  useSessionViewPrefs,
  useSelectedProjectIds,
  useProjectFilteredSessions,
  useSlotHistory,
  useSlotHistoryCount,
  useSessions,
  useSortedGroupedSessions,
  useStageGroupedSessions,
  useWorkspaceRollup,
  useSummarizerStatus,
  useSessionHasUnread,
  useWorkspaceHasUnread,
  useHasUnreadElsewhere,
  useWorkspaces,
  type FilesTouched,
  type MountDiffStat,
} from './selectors';
export { useTranscript } from './transcript';
export { readPersistedLens } from './slices/session-view';
export type { SessionStudio, LensKind, DiffFocus } from './slices/session-view';
export { NO_PROJECT_FILTER_ID, sessionMatchesProjectFilter } from './slices/sessionFilters';

export const EMPTY_ARRAY: readonly never[] = [];
