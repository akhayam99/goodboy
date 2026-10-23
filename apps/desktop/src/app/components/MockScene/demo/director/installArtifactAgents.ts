import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactId,
  type IsoDateTime,
  type SessionArtifact,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import type { DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { finishAgentTurn } from './finishAgentTurn';
import { scheduleCues } from './scheduleCues';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const SAMPLE =
  'This is a sample run. No agent is connected in this playground. The result is saved in Artifacts.';

type ArtifactParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly kind: 'report' | 'wireframe';
  readonly runId: ProviderRunId;
  readonly at: IsoDateTime;
};

const sampleArtifactOf = ({
  store,
  sessionId,
  agentId,
  kind,
  runId,
  at,
}: ArtifactParams): SessionArtifact | null => {
  const state = store.getState();
  const base = {
    id: brandId<ArtifactId>({ value: `demo-${kind}-${agentId}` }),
    sessionId,
    agentId,
    workflowRunId: null,
    schemaVersion: 1,
    status: 'active' as const,
    revision: 1,
    sourceTurnId: runId,
    createdAt: at,
    updatedAt: at,
    openedAt: null,
  };
  if (kind === 'report') {
    const goal = sessionById(state.sessions, sessionId)?.goal ?? 'this session';
    return {
      ...base,
      kind: 'report',
      title: 'Session summary',
      sourceFormat: 'markdown',
      sourceText: `## Goal\n\n${goal}\n\n## Note\n\nThis is a sample report from the playground. In the app an agent writes it from the session's runs, changes and questions.`,
      metadata: { reportType: 'session-summary' },
    };
  }
  const saved = Object.values(state.sessionArtifacts)
    .flat()
    .find((artifact) => artifact.kind === 'wireframe' && artifact.status === 'active');
  return saved === undefined || saved.kind !== 'wireframe'
    ? null
    : { ...saved, ...base, kind: 'wireframe' };
};

type Params = {
  readonly store: DirectorStore;
};

type SpawnParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly kind: 'report' | 'wireframe';
  readonly name: string;
  readonly brief: string;
};

const spawnSample = ({ store, sessionId, kind, name, brief }: SpawnParams): AgentId => {
  const agentId = brandId<AgentId>({ value: `demo-${kind}-${crypto.randomUUID()}` });
  const runId = brandId<ProviderRunId>({ value: `${agentId}-run` });
  const at = nowIso({});
  const agent: Agent = {
    id: agentId,
    sessionId,
    ordinal: (store.getState().sessionPhaseRuns[sessionId] ?? []).length + 1,
    name,
    kind,
    status: 'running',
    startedAt: at,
  };
  store.setState((current) => ({
    sessionPhaseRuns: {
      ...current.sessionPhaseRuns,
      [sessionId]: [...(current.sessionPhaseRuns[sessionId] ?? []), agent],
    },
  }));
  appendTurnEvents({ store, agentId, events: [{ kind: 'user_text', runId, text: brief, at }] });
  startAgentTurn({ store, sessionId, agentId, runId, at });
  scheduleCues({
    store,
    agentId,
    now: () => nowIso({}),
    cues: [
      ...textCues({ atMs: 900, agentId, runId, text: SAMPLE }),
      {
        atMs: textCuesEndMs({ atMs: 900, text: SAMPLE }) + 400,
        apply: ({ store: target, at: doneAt }) => {
          const artifact = sampleArtifactOf({
            store: target,
            sessionId,
            agentId,
            kind,
            runId,
            at: doneAt,
          });
          if (artifact !== null) {
            target.setState((current) => ({
              sessionArtifacts: {
                ...current.sessionArtifacts,
                [sessionId]: [...(current.sessionArtifacts[sessionId] ?? []), artifact],
              },
            }));
          }
          appendTurnEvents({
            store: target,
            agentId,
            events: [{ kind: 'done', runId, at: doneAt }],
          });
          finishAgentTurn({ store: target, sessionId, agentId, at: doneAt, isViewed: true });
        },
      },
    ],
  });
  return agentId;
};

type BriefParams = {
  readonly brief: string | null | undefined;
  readonly fallback: string;
};

const briefOf = ({ brief, fallback }: BriefParams): string =>
  brief === null || brief === undefined || brief.trim() === '' ? fallback : brief.trim();

export const installArtifactAgents = ({ store }: Params): void => {
  const spawnReportAgent: AppStore['spawnReportAgent'] = async ({ sessionId, brief }) =>
    spawnSample({
      store,
      sessionId,
      kind: 'report',
      name: 'Write a report',
      brief: briefOf({ brief, fallback: 'Write a session summary.' }),
    });
  const spawnWireframeAgent: AppStore['spawnWireframeAgent'] = async ({ sessionId, brief }) =>
    spawnSample({
      store,
      sessionId,
      kind: 'wireframe',
      name: 'Sketch a wireframe',
      brief: briefOf({ brief, fallback: 'Sketch a wireframe.' }),
    });
  store.setState({ spawnReportAgent, spawnWireframeAgent });
};
