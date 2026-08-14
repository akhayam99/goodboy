export { useAppStore, type ProviderSpendEntry } from './store';
export type { BootPhase } from './types';

export {
  agentHasUnread,
  useCurrentSession,
  useCurrentWorkspace,
  useDiffComments,
  useFilesTouched,
  useLiveTerminalCount,
  useSessionAnsweredQuestions,
  useSessionById,
  useSessionCost,
  useSessionLoading,
  useNonResolverStandaloneAgents,
  useSessionOpenQuestions,
  useSessionPlans,
  useRunSpendUsd,
  useSessionPrFetchState,
  useSessionSlots,
  useSessionStageInfo,
  useSessionUnreadLens,
  useSessionViewPrefs,
  useSlotHistory,
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
export { readPersistedLens, LENS_KINDS } from './slices/session-view';
export type { SessionStudio, LensKind, DiffFocus } from './slices/session-view';

export const EMPTY_ARRAY: readonly never[] = [];
