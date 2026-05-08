export {
  useAppStore,
  type AppActions,
  type AppState,
  type BootPhase,
  type ProviderSpendEntry,
  type SummarizerSessionStatus,
  type SystemAlert,
  type SystemAlertKind,
} from './store';
export type { DetectedEditor } from '../editor';

export {
  selectCurrentSession,
  selectCurrentWorkspace,
  selectSessions,
  selectWorkspaces,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionSlots,
  useSessions,
  useSummarizerStatus,
  useWorkspaces,
} from './selectors';
export { selectTranscript, useTranscript } from './transcript';

export const EMPTY_ARRAY: readonly never[] = [];
