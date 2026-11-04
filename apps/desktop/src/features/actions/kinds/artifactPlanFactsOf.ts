import type {
  Agent,
  ArtifactComment,
  OpenQuestion,
  PlanWithCount,
  Session,
  SessionArtifact,
  SessionId,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { isPlanHeldByAuto } from '../../auto/isPlanHeldByAuto';
import { plannerQuestionsOf } from '../../plans/plannerQuestions';
import { planOwnerOf } from '../../plans/planOwnerOf';
import { NOT_REVISING, planRevisingOf, type PlanRevising } from '../../plans/planRevising';

export type ArtifactPlanFacts = Readonly<{
  planRevising: PlanRevising;
  planRun: WorkflowRun | null;
  planDrafts: ReadonlyArray<ArtifactComment>;
  plannerQuestionCount: number;
  isPlanHeldByAuto: boolean;
}>;

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly session: Session | null;
  readonly artifact: SessionArtifact | null;
  readonly artifactId: SessionArtifact['id'];
  readonly plan: PlanWithCount | null;
  readonly isPlan: boolean;
};

const NO_DRAFTS: ReadonlyArray<ArtifactComment> = [];

const NO_VIEWS: ReadonlyArray<AutoTreeView> = [];

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_TEMPLATES: ReadonlyArray<Workflow> = [];

export const artifactPlanFactsOf = ({
  state,
  sessionId,
  session,
  artifact,
  artifactId,
  plan,
  isPlan,
}: Params): ArtifactPlanFacts => ({
  planRevising:
    artifact === null || artifact.kind !== 'plan'
      ? NOT_REVISING
      : planRevisingOf({ artifact, turn: state.agentTurnState[artifact.agentId] }),
  planRun:
    plan === null || session === null
      ? null
      : planOwnerOf({
          plan,
          agents: state.sessionPhaseRuns[sessionId] ?? NO_AGENTS,
          runs: session.workflowRuns,
          templates: state.phaseTemplates[session.workspaceId] ?? NO_TEMPLATES,
        }),
  planDrafts: isPlan
    ? (state.artifactComments[sessionId] ?? NO_DRAFTS).filter(
        (comment) => comment.artifactId === artifactId && comment.status === 'draft',
      )
    : NO_DRAFTS,
  plannerQuestionCount:
    plan === null
      ? 0
      : plannerQuestionsOf({
          questions: state.sessionOpenQuestions[sessionId] ?? NO_QUESTIONS,
          plan,
        }).length,
  isPlanHeldByAuto: isPlanHeldByAuto({
    views: state.autoTreeViews[sessionId] ?? NO_VIEWS,
    planId: artifactId,
  }),
});
