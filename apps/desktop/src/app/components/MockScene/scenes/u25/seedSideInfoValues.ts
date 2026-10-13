import type {
  Agent,
  AgentId,
  ArtifactId,
  PlanArtifact,
  Session,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const SESSION_ID = brandedId<SessionId>({ value: 'mock-sidebar-session-webhooks' });
const RUN_ID = brandedId<WorkflowRunId>({ value: 'mock-side-info-run' });
const STEP_ID = brandedId<StepId>({ value: 'mock-side-info-step' });

const RUN: WorkflowRun = {
  id: RUN_ID,
  workflowId: brandedId<WorkflowId>({ value: 'mock-side-info-workflow' }),
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  goal: 'Retry failed webhook deliveries',
  createdAt: clock.iso({ at: '2026-10-07T09:20:00.000Z' }),
};

type AgentParams = {
  readonly index: number;
  readonly name: string;
  readonly isInRun: boolean;
};

const agentOf = ({ index, name, isInRun }: AgentParams): Agent => ({
  id: brandedId<AgentId>({ value: `mock-side-info-agent-${index}` }),
  sessionId: SESSION_ID,
  ordinal: index,
  name,
  kind: isInRun ? 'implementer' : 'scout',
  status: isInRun ? 'running' : 'completed',
  startedAt: clock.iso({ at: '2026-10-07T09:25:00.000Z' }),
  ...(isInRun ? { stepId: STEP_ID, workflowRunId: RUN_ID } : {}),
});

const AGENTS: ReadonlyArray<Agent> = [
  agentOf({ index: 0, name: 'Scout the retry path', isInRun: false }),
  agentOf({ index: 1, name: 'Read the delivery logs', isInRun: false }),
  agentOf({ index: 2, name: 'Map the notify-relay queue', isInRun: false }),
  agentOf({ index: 3, name: 'Implement the retry window', isInRun: true }),
];

type ArtifactParams = {
  readonly index: number;
  readonly title: string;
};

const artifactOf = ({ index, title }: ArtifactParams): PlanArtifact => ({
  id: brandedId<ArtifactId>({ value: `mock-side-info-artifact-${index}` }),
  sessionId: SESSION_ID,
  agentId: brandedId<AgentId>({ value: 'mock-side-info-agent-0' }),
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title,
  sourceFormat: 'markdown',
  sourceText: `# ${title}`,
  metadata: {},
  status: 'consumed',
  revision: 1,
  sourceTurnId: null,
  createdAt: clock.iso({ at: '2026-10-07T09:30:00.000Z' }),
  updatedAt: clock.iso({ at: '2026-10-07T09:30:00.000Z' }),
  openedAt: clock.iso({ at: '2026-10-07T09:40:00.000Z' }),
});

export const seedSideInfoValues = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: state.sessions.map((session): Session =>
      session.id === SESSION_ID ? { ...session, workflowRuns: [RUN] } : session,
    ),
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [SESSION_ID]: AGENTS },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [SESSION_ID]: [
        artifactOf({ index: 0, title: 'Retry window' }),
        artifactOf({ index: 1, title: 'Backoff schedule' }),
        artifactOf({ index: 2, title: 'Delivery report' }),
      ],
    },
  });
};
