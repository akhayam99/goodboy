import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_PERMISSION_MODE } from '../../../../../features/permissions/modeCopy';
import type { AgentKindRouting } from '../../../../../features/session/agent-kind';
import { useAppStore } from '../../../../../store';
import { selectWorkspaceKindRouting } from '../../../../../store/slices/agents/selectWorkspaceKindRouting';
import type { AppStore } from '../../../../../store/store';
import type { StartSessionFromDraftParams } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { draftGoalText } from '../../../../../store/slices/sessionDraft/draftGoalText';
import { applyAgentTurnState } from '../../../../../store/slices/sessions/sessionMutators';
import { appendTurnEvents } from '../../demo/director/appendTurnEvents';
import { finishAgentTurn } from '../../demo/director/finishAgentTurn';
import { patchAgent } from '../../demo/director/patchAgent';
import { startAgentTurn } from '../../demo/director/startAgentTurn';
import { sampleScoutRuns } from './sampleScoutRuns';
import { seedShellChrome } from '../shellChrome';
import { sampleScoutReply } from './sampleScoutReply';

const THINK_MS = 1400;
const SENTENCE_MS = 1100;
const DONE_MS = 900;

const IDLE_LOADING = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

type SplitParams = {
  readonly text: string;
};

const sentencesOf = ({ text }: SplitParams): ReadonlyArray<string> =>
  text
    .split('. ')
    .map(
      (part, index, parts) =>
        `${index === 0 ? '' : ' '}${part}${index < parts.length - 1 ? '.' : ''}`,
    );

type StreamParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly reply: string;
};

const streamReply = ({ sessionId, agentId, runId, reply }: StreamParams): void => {
  const store = useAppStore;
  const sentences = sentencesOf({ text: reply });
  sentences.forEach((delta, index) => {
    sampleScoutRuns.later({
      agentId,
      runId,
      delayMs: THINK_MS + index * SENTENCE_MS,
      run: () => {
        appendTurnEvents({
          store,
          agentId,
          events: [{ kind: 'assistant_text', runId, delta, at: nowIso({}) }],
        });
      },
    });
  });
  sampleScoutRuns.later({
    agentId,
    runId,
    delayMs: THINK_MS + sentences.length * SENTENCE_MS + DONE_MS,
    run: () => {
      const at = nowIso({});
      appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
      sampleScoutRuns.finish({
        agentId,
        runId,
        onIdle: () => finishAgentTurn({ store, sessionId, agentId, at, isViewed: true }),
      });
    },
  });
};

type StopParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const stopScout = ({ sessionId, agentId }: StopParams): void => {
  sampleScoutRuns.cancel();
  const at = nowIso({});
  patchAgent({
    store: useAppStore,
    sessionId,
    agentId,
    patch: { status: 'stopped', stoppedAt: at, stoppedBy: 'you' },
  });
  applyAgentTurnState(
    useAppStore.setState,
    sessionId,
    agentId,
    { kind: 'idle', lastActivityAt: at },
    at,
  );
};

type FocusParams = {
  readonly start: StartSessionFromDraftParams['start'];
};

const focusOf = ({ start }: FocusParams): string => {
  switch (start.kind) {
    case 'scout':
      return start.focus;
    case 'task':
    case 'workflow-run':
      return start.goal;
    default: {
      const unreachable: never = start;
      return unreachable;
    }
  }
};

type RoutingParams = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly start: StartSessionFromDraftParams['start'];
};

const routingOf = ({ state, workspaceId, start }: RoutingParams): AgentKindRouting => {
  if (start.kind === 'scout' && start.routing !== null) {
    return start.routing;
  }
  return selectWorkspaceKindRouting({ state, workspaceId, kind: 'scout' });
};

export const startSampleScout = async ({
  workspaceId,
  start,
}: StartSessionFromDraftParams): Promise<Session> => {
  sampleScoutRuns.cancel();
  const state = useAppStore.getState();
  const { provider, model } = routingOf({ state, workspaceId, start });
  const permissionMode =
    state.sessionDrafts[workspaceId]?.permissionMode ?? DEFAULT_PERMISSION_MODE;
  const focus = focusOf({ start }).trim();
  const projectId = state.sessionDrafts[workspaceId]?.projectIds[0] ?? null;
  const folder = projectById(state.projects, projectId)?.name ?? 'this workspace';
  const at = nowIso({});
  const sessionId = brandId<SessionId>({ value: `sample-session-${crypto.randomUUID()}` });
  const agentId = brandId<AgentId>({ value: `sample-agent-${crypto.randomUUID()}` });
  const runId = sampleScoutRuns.nextRunId({ agentId });
  const session: Session = {
    id: sessionId,
    workspaceId,
    goal: draftGoalText({ text: focus }),
    state: { kind: 'idle', lastActivityAt: at },
    contextSlots: [],
    providerPreference: { defaultProvider: provider, allowTurnOverride: true },
    permissionMode,
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    ...(projectId === null ? {} : { activeProjectId: projectId }),
    createdAt: at,
    updatedAt: at,
  };
  const scout: Agent = {
    id: agentId,
    sessionId,
    ordinal: 1,
    name: 'Scout',
    kind: 'scout',
    status: 'pending',
    providerOverride: provider,
    modelOverride: model,
  };
  seedShellChrome({ session, siblings: [], branches: {}, telemetryAt: at, lens: 'workflows' });
  useAppStore.setState({
    selectedAgentId: { [sessionId]: agentId },
    sessionPhaseRuns: { [sessionId]: [scout] },
    transcripts: { [agentId]: [] },
    sessionEvents: { [sessionId]: [] },
    sessionProjectMounts: { [sessionId]: [] },
    sessionOpenQuestions: { [sessionId]: [] },
    sessionAnsweredQuestions: { [sessionId]: [] },
    sessionDismissedQuestions: { [sessionId]: [] },
    sessionPlans: { [sessionId]: [] },
    sessionExternalTasks: { [sessionId]: [] },
    sessionLoading: { [sessionId]: IDLE_LOADING },
    loadSessionEvents: async () => undefined,
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    loadAgentTranscript: async () => undefined,
    markAgentViewed: async () => undefined,
    recordSessionEvent: async () => undefined,
    cancelCurrentTurn: (async (targetSessionId) => {
      if (targetSessionId !== sessionId) {
        return;
      }
      stopScout({ sessionId, agentId });
    }) satisfies AppStore['cancelCurrentTurn'],
  });
  sampleScoutRuns.enqueue({
    agentId,
    runId,
    start: () => {
      appendTurnEvents({
        store: useAppStore,
        agentId,
        events: [{ kind: 'user_text', runId, text: focus, provider, model, at }],
      });
      startAgentTurn({ store: useAppStore, sessionId, agentId, runId, at });
      streamReply({ sessionId, agentId, runId, reply: sampleScoutReply({ focus, folder }) });
    },
  });
  return session;
};
