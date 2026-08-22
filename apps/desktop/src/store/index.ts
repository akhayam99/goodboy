export { useAppStore, type ProviderSpendEntry } from './store';
export type { BootPhase } from './types';

export {
  agentHasUnread,
  useCurrentSession,
  useCurrentWorkspace,
  useDiffComments,
  useFilesTouched,
  useSessionAnsweredQuestions,
  useSessionById,
  useSessionCost,
  useSessionLoading,
  useIsSessionCollectionLoaded,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useRunSpendUsd,
  useSessionPrFetchState,
  useSessionSlots,
  useSessionSlotsLoad,
  useSessionStageInfo,
  useSessionViewPrefs,
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
} from './selectors';
export { useTranscript } from './transcript';
export { readPersistedLens } from './slices/session-view';
export type { SessionStudio, LensKind, DiffFocus } from './slices/session-view';

export const EMPTY_ARRAY: readonly never[] = [];
