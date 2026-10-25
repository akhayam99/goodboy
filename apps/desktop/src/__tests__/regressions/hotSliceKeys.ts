import type { AgentsState } from '../../store/slices/agents/state';
import type { ProjectMountsState } from '../../store/slices/project-mounts/state';
import type { ScriptsSliceState } from '../../store/slices/scripts/state';
import type { SessionsState } from '../../store/slices/sessions/state';
import type { TranscriptsState } from '../../store/slices/transcripts/state';

const TRANSCRIPTS_HOT_KEYS: ReadonlyArray<keyof TranscriptsState> = [
  'transcripts',
  'unknownPayloadCounts',
];

const AGENTS_HOT_KEYS: ReadonlyArray<keyof AgentsState> = ['agentTurnState', 'agentRunHistory'];

const PROJECT_MOUNTS_HOT_KEYS: ReadonlyArray<keyof ProjectMountsState> = ['sessionProjectMounts'];

const SESSIONS_HOT_KEYS: ReadonlyArray<keyof SessionsState> = [
  'sessionTelemetry',
  'sessionExternalTasks',
];

const SCRIPTS_HOT_KEYS: ReadonlyArray<keyof ScriptsSliceState> = ['scriptRuns'];

export const HOT_SLICE_KEYS: ReadonlySet<string> = new Set<string>([
  ...TRANSCRIPTS_HOT_KEYS,
  ...AGENTS_HOT_KEYS,
  ...PROJECT_MOUNTS_HOT_KEYS,
  ...SESSIONS_HOT_KEYS,
  ...SCRIPTS_HOT_KEYS,
]);
