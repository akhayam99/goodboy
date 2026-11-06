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
import { planNextStepNameOf } from '../../plans/planNextStepNameOf';
import { planOwnerOf } from '../../plans/planOwnerOf';
import { NOT_REVISING, planRevisingOf, type PlanRevising } from '../../plans/planRevising';

export type ArtifactPlanFacts = Readonly<{
  planRevising: PlanRevising;
  planRun: WorkflowRun | null;
  planDrafts: ReadonlyArray<ArtifactComment>;
  plannerQuestionCount: number;
  isPlanHeldByAuto: boolean;
  planNextStepName: string | null;
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
}: Params): ArtifactPlanFacts => {
  const agents = state.sessionPhaseRuns[sessionId] ?? NO_AGENTS;
  const templates =
    session === null ? NO_TEMPLATES : (state.phaseTemplates[session.workspaceId] ?? NO_TEMPLATES);
  const planRun =
    plan === null || session === null
      ? null
      : planOwnerOf({ plan, agents, runs: session.workflowRuns, templates });
  return {
    planRevising:
      artifact === null || artifact.kind !== 'plan'
        ? NOT_REVISING
        : planRevisingOf({ artifact, turn: state.agentTurnState[artifact.agentId] }),
    planRun,
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
    planNextStepName: planNextStepNameOf({ run: planRun, templates, agents }),
  };
};
