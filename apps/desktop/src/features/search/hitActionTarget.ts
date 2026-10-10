import type { ArtifactId, SearchHit } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { askingAgentIdsOf } from '../plans/askingAgentIdsOf';
import { buildArtifactListRows } from '../artifacts/artifactListRows';
import type { ObjectTarget } from '../actions/types';

type Params = {
  readonly hit: SearchHit;
  readonly state: AppState;
};

export const hitPlanRunning = ({ hit, state }: Params): boolean => {
  if (hit.sessionId === null) {
    return false;
  }
  const session = sessionById(state.sessions, hit.sessionId);
  const rows = buildArtifactListRows({
    plans: state.sessionPlans[hit.sessionId] ?? [],
    artifacts: state.sessionArtifacts[hit.sessionId] ?? [],
    generations: [],
    agents: state.sessionPhaseRuns[hit.sessionId] ?? [],
    runs: session?.workflowRuns ?? [],
    templates: session === undefined ? [] : (state.phaseTemplates[session.workspaceId] ?? []),
    openQuestionCount: (state.sessionOpenQuestions[hit.sessionId] ?? []).length,
    now: Date.now(),
    revising: new Map(),
    askingAgentIds: askingAgentIdsOf({
      questions: state.sessionOpenQuestions[hit.sessionId] ?? [],
    }),
  });
  const row = rows.find((candidate) => candidate.id === `artifact:${hit.refId}`);
  return row !== undefined && row.isPlanRunning;
};

type HitParams = {
  readonly hit: SearchHit;
};

const linkOf = ({ hit }: HitParams): ObjectTarget | null =>
  hit.url === null ? null : { kind: 'link', href: hit.url };

type TargetParams = {
  readonly hit: SearchHit;
  readonly isPlanRunning: boolean;
};

export const hitActionTarget = ({ hit, isPlanRunning }: TargetParams): ObjectTarget | null => {
  if (hit.isArchived || hit.sessionId === null) {
    return linkOf({ hit });
  }
  switch (hit.kind) {
    case 'session':
      return { kind: 'session', sessionId: hit.sessionId };
    case 'agent':
    case 'message':
      return hit.agentId === null
        ? null
        : { kind: 'agent', sessionId: hit.sessionId, agentId: hit.agentId };
    case 'plan':
    case 'report':
    case 'wireframe':
      return {
        kind: 'artifact',
        sessionId: hit.sessionId,
        subject: {
          kind: 'stored',
          artifactId: hit.refId as ArtifactId,
          isPlanRunning,
        },
      };
    case 'issue':
    case 'pr':
      return linkOf({ hit });
    case 'decision':
    case 'question':
    case 'branch':
    case 'workflow':
    case 'comment':
      return null;
    default: {
      const exhaustive: never = hit.kind;
      return exhaustive;
    }
  }
};
