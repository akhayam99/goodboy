export { useAppStore, type BootPhase, type ProviderSpendEntry } from './store';

export {
  agentHasUnread,
  useCurrentSession,
  useCurrentWorkspace,
  useDiffComments,
  useFilesTouched,
  useSessionAnsweredQuestions,
  useSessionById,
  useSessionLoading,
  useSessionOpenQuestions,
  useSessionPlans,
  useSessionSlots,
  useSessionStageInfo,
  useSessionViewPrefs,
  useSlotHistory,
  useSessions,
  useSortedGroupedSessions,
  useSummarizerStatus,
  useSessionHasUnread,
  useWorkspaceHasUnread,
  useHasUnreadElsewhere,
  useWorkspaces,
  type FilesTouched,
} from './selectors';
export { useTranscript } from './transcript';
export { readPersistedLens, LENS_KINDS } from './slices/session-view';
export type { SessionStudio, LensKind } from './slices/session-view';

export const EMPTY_ARRAY: readonly never[] = [];
