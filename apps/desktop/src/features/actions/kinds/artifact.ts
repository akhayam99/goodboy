import {
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileDown,
  FolderOpen,
  Pencil,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  Agent,
  AgentId,
  ArtifactComment,
  ArtifactKind,
  ArtifactStatus,
  ArtifactId,
  OpenQuestion,
  PlanWithCount,
  ReportArtifact,
  SessionArtifact,
  WireframeArtifact,
  SessionId,
  Workflow,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { planApprovedToast } from '../../plans/planApprovedToast';
import { planAsArtifact } from '../../plans/planAsArtifact';
import { planEditBlockOf } from '../../plans/planEditBlock';
import { planPrimaryOf, type PlanPrimary } from '../../plans/planPrimaryOf';
import { plannerQuestionsOf } from '../../plans/plannerQuestions';
import { unsentCommentsQuestion } from '../../plans/unsentCommentsQuestion';
import { planRunOf } from '../../plans/planRunOf';
import { planRunToast } from '../../plans/planRunToast';
import { openPlanDrawer } from '../../plans/openPlanDrawer';
import { NOT_REVISING, planRevisingOf, type PlanRevising } from '../../plans/planRevising';
import { planConsumerLabel, resolvePlanConsumer } from '../../../shared/utils/planConsumer';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import { agentPlace, sessionPlace } from '../../../store/slices/navigation/place';
import type { ArtifactGeneration } from '../../artifacts/artifactCollection';
import {
  artifactKickoff,
  artifactSourceContents,
  openArtifactCopy,
  otherWireframeFidelity,
  regenerateReport,
  retryArtifactGeneration,
  revealArtifactCopy,
  saveArtifactSource,
  spawnWireframeVariant,
} from '../../artifacts/artifactActionRuns';
import { artifactSourceExport } from '../../artifacts/hooks/useArtifactExport/artifactSourceExport';
import { REGENERATE_BLOCKED_HINT, REGENERATE_READY_HINT } from '../../reports/useReportRegenerate';
import { WIREFRAME_FIDELITY_VARIANT_LABEL } from '../../wireframes/wireframeFidelity';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type {
  ActionDefinition,
  ActionEnv,
  ArtifactActionTarget,
  ArtifactPort,
  ArtifactPortId,
  ArtifactPorts,
  ObjectKindDefinition,
} from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { AppStore } from '../../../store/store';
import { isRunHeldForPlan } from '../../../store/slices/workflows/workflowPlanApproval';

export const ARTIFACT_EDIT_EVENT = 'goodboy:artifact-edit';

export type ArtifactFacts = {
  readonly sessionId: SessionId;
  readonly workspaceSlug: string | null;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly plan: PlanWithCount | null;
  readonly stored: SessionArtifact | null;
  readonly planStatus: ArtifactStatus | null;
  readonly status: ArtifactStatus | null;
  readonly isPlanRunning: boolean;
  readonly planRevising: PlanRevising;
  readonly planRun: WorkflowRun | null;
  readonly planDrafts: ReadonlyArray<ArtifactComment>;
  readonly plannerQuestionCount: number;
  readonly generation: ArtifactGeneration | null;
  readonly kickoff: string | null;
  readonly ports: ArtifactPorts;
};

const NO_PORTS: ArtifactPorts = {};

const NO_DRAFTS: ReadonlyArray<ArtifactComment> = [];

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

const NO_AGENTS: ReadonlyArray<Agent> = [];

const NO_TEMPLATES: ReadonlyArray<Workflow> = [];

type FactsOnly = { readonly facts: ArtifactFacts };

const portOf = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): ArtifactPort | null =>
  facts.ports[id] ?? null;

const artifactOf = ({ facts }: FactsOnly): SessionArtifact | null =>
  facts.plan === null ? facts.stored : planAsArtifact({ plan: facts.plan, stored: facts.stored });

const wireframeDescription = ({
  artifact,
}: {
  readonly artifact: WireframeArtifact | null;
}): string | null =>
  artifact === null
    ? null
    : `Runs the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherWireframeFidelity({ artifact })]}, leaving this one untouched`;

const noCopyReason = ({ facts }: FactsOnly): string | null =>
  facts.workspaceSlug === null ? 'This session has no workspace folder' : null;

const idOf = ({ facts }: FactsOnly): ArtifactId | null =>
  facts.plan?.id ?? facts.stored?.id ?? null;

const reportOf = ({ facts }: FactsOnly): ReportArtifact | null =>
  facts.stored?.kind === 'report' ? facts.stored : null;

const wireframeOf = ({ facts }: FactsOnly): WireframeArtifact | null =>
  facts.stored?.kind === 'wireframe' ? facts.stored : null;

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const isIdlePlan = ({ facts }: FactsOnly): boolean =>
  facts.kind === 'plan' && artifactOf({ facts }) !== null && !facts.isPlanRunning;

const planIn = ({
  facts,
  statuses,
}: FactsOnly & { readonly statuses: ReadonlyArray<ArtifactStatus> }): boolean =>
  isIdlePlan({ facts }) && facts.planStatus !== null && statuses.includes(facts.planStatus);

const isStored = ({ facts }: FactsOnly): boolean => facts.plan !== null || facts.stored !== null;

const isDeleted = ({ facts }: FactsOnly): boolean => facts.status === 'discarded';

const isLiveStored = ({ facts }: FactsOnly): boolean =>
  isStored({ facts }) && !isDeleted({ facts });

const runHistoryOf = ({ facts }: FactsOnly): string | null => {
  const consumer = facts.plan?.lastConsumer ?? null;
  if (facts.plan === null || consumer === null || facts.plan.consumptionCount === 0) {
    return null;
  }
  const { name } = resolvePlanConsumer({ agentId: consumer.agentId, agentName: consumer.name });
  return planConsumerLabel({ name, count: facts.plan.consumptionCount });
};

const agentOf = ({ facts }: FactsOnly): AgentId | null =>
  facts.generation?.agentId ?? artifactOf({ facts })?.agentId ?? null;

const primaryOf = ({ facts }: FactsOnly): PlanPrimary =>
  planPrimaryOf({
    plan: facts.plan ?? { status: facts.planStatus ?? 'active', consumptionCount: 0 },
    run: facts.planRun,
    drafts: facts.planDrafts,
    revising: facts.planRevising,
    isRunning: facts.isPlanRunning,
    plannerQuestionCount: facts.plannerQuestionCount,
  });

const editBlockOf = ({ facts }: FactsOnly): string | null =>
  facts.kind === 'plan'
    ? planEditBlockOf({
        plan: { clusters: facts.plan?.clusters },
        drafts: facts.planDrafts,
        isRevising: facts.planRevising.kind === 'revising',
      })
    : null;

const isOnArtifactsLens = ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): boolean => {
  const state = env.getState();
  return (
    state.currentSessionId === facts.sessionId && state.activeLens[facts.sessionId] === 'plans'
  );
};

const openArtifact = ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): void => {
  const artifactId = idOf({ facts });
  if (artifactId === null) {
    return;
  }
  env.getState().navigate({
    to: sessionPlace({
      sessionId: facts.sessionId,
      lens: 'plans',
      target: { kind: 'artifact', artifactId },
    }),
  });
};

type PortedParams = {
  readonly id: ArtifactPortId;
  readonly fallback: (params: FactsOnly & { readonly env: ActionEnv }) => void | Promise<void>;
};

const ported =
  ({ id, fallback }: PortedParams) =>
  async ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): Promise<void> => {
    const port = portOf({ facts, id });
    if (port !== null) {
      await port.run();
      return;
    }
    await fallback({ facts, env });
  };

const portLabel = ({
  facts,
  id,
  fallback,
}: FactsOnly & { readonly id: ArtifactPortId; readonly fallback: string }): string =>
  portOf({ facts, id })?.label ?? fallback;

const portBlocked = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): string | null =>
  portOf({ facts, id })?.blockedReason ?? null;

const portBusy = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): boolean =>
  portOf({ facts, id })?.isBusy === true;

const stepNameOf = ({
  state,
  sessionId,
  agentId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
}): string =>
  (state.sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === agentId)?.name ??
  'The next step';

const isOnRunPage = ({
  state,
  sessionId,
  runId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
}): boolean =>
  state.currentSessionId === sessionId &&
  state.activeLens[sessionId] === 'workflows' &&
  state.focusedWorkflowRunId[sessionId] === runId;

type ApprovedParams = FactsOnly & {
  readonly env: ActionEnv;
  readonly runId: WorkflowRunId;
  readonly startedAgentId: AgentId | null;
};

const showApproved = ({ facts, env, runId, startedAgentId }: ApprovedParams): void => {
  const state = env.getState();
  env.showToast(
    planApprovedToast({
      sessionId: facts.sessionId,
      runId,
      startedStepName:
        startedAgentId === null
          ? null
          : stepNameOf({ state, sessionId: facts.sessionId, agentId: startedAgentId }),
      isOnRunPage: isOnRunPage({ state, sessionId: facts.sessionId, runId }),
      navigate: state.navigate,
    }),
  );
};

type RunPlanParams = FactsOnly & {
  readonly env: ActionEnv;
  readonly approvesRun?: WorkflowRun | null;
};

const runPlan = async ({ facts, env, approvesRun = null }: RunPlanParams): Promise<void> => {
  const planId = idOf({ facts });
  if (planId === null) {
    return;
  }
  const state = env.getState();
  const result = await state.runPlan(facts.sessionId, planId);
  if (approvesRun !== null && result.kind === 'started' && result.scope === 'workflow') {
    showApproved({ facts, env, runId: approvesRun.id, startedAgentId: result.agentId });
    return;
  }
  const toast = planRunToast({
    result,
    sessionId: facts.sessionId,
    navigate: state.navigate,
  });
  if (toast !== null) {
    env.showToast(toast);
  }
};

const approvePlan = async ({
  facts,
  env,
}: FactsOnly & { readonly env: ActionEnv }): Promise<void> => {
  const run = facts.planRun;
  if (run === null) {
    return;
  }
  if (!isRunHeldForPlan({ run })) {
    await runPlan({ facts, env, approvesRun: run });
    return;
  }
  const state = env.getState();
  const result = await state.approveWorkflowRunPlan(facts.sessionId, run.id);
  if (result.kind === 'failed') {
    await state.reportError({
      title: "Couldn't approve the plan",
      error: new Error(result.message),
      sessionId: facts.sessionId,
    });
    return;
  }
  if (result.kind === 'approved') {
    showApproved({
      facts,
      env,
      runId: run.id,
      startedAgentId: result.next === 'started' ? result.agentId : null,
    });
  }
};

const runPlanAction = async ({
  facts,
  env,
}: FactsOnly & { readonly env: ActionEnv }): Promise<void> => {
  if (primaryOf({ facts }).kind === 'approve') {
    await approvePlan({ facts, env });
    return;
  }
  await ported({ id: 'runPlan', fallback: runPlan })({ facts, env });
};

const ARTIFACT_ACTIONS: ReadonlyArray<ActionDefinition<ArtifactFacts>> = [
  {
    id: 'artifact.open',
    label: 'Open',
    icon: CONCEPT_ICONS.artifacts,
    group: 'open',
    when: ({ facts, viewing }) =>
      isStored({ facts }) && !(viewing?.kind === 'artifact' && viewing.id === idOf({ facts })),
    run: ({ facts, env }) => {
      const planId = idOf({ facts });
      if (facts.kind === 'plan' && planId !== null && !isOnArtifactsLens({ facts, env })) {
        openPlanDrawer({ sessionId: facts.sessionId, planId });
        return;
      }
      openArtifact({ facts, env });
    },
  },
  {
    id: 'artifact.openAgent',
    label: 'Open agent',
    icon: CONCEPT_ICONS.agents,
    group: 'open',
    when: ({ facts }) =>
      (facts.kind === 'plan' || facts.generation !== null) && agentOf({ facts }) !== null,
    run: ({ facts, env }) => {
      const agentId = agentOf({ facts });
      if (agentId !== null) {
        env.getState().navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId }) });
      }
    },
  },
  {
    id: 'artifact.runPlan',
    label: ({ facts }) => primaryOf({ facts }).label ?? 'Run plan',
    icon: Play,
    group: 'act',
    slot: () => 'primary',
    when: ({ facts }) =>
      planIn({ facts, statuses: ['active'] }) && primaryOf({ facts }).kind !== 'none',
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'runPlan' }) ?? primaryOf({ facts }).reason,
    confirm: ({ facts }) =>
      primaryOf({ facts }).kind === 'approve' && facts.planDrafts.length > 0
        ? {
            title: unsentCommentsQuestion({ count: facts.planDrafts.length }),
            description: 'Approving starts the run without them. They stay on the plan as drafts.',
            confirmLabel: 'Approve anyway',
            role: 'alert',
          }
        : null,
    isBusy: ({ facts }) => portBusy({ facts, id: 'runPlan' }),
    run: runPlanAction,
  },
  {
    id: 'artifact.edit',
    label: 'Edit',
    icon: Pencil,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) =>
      planIn({ facts, statuses: ['active'] }) ||
      (facts.kind === 'report' && isLiveStored({ facts })),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'edit' }) ?? editBlockOf({ facts }),
    run: ported({
      id: 'edit',
      fallback: ({ facts, env }) => {
        openArtifact({ facts, env });
        dispatchAfterNavigation({
          name: ARTIFACT_EDIT_EVENT,
          detail: { artifactId: artifactOf({ facts })?.id ?? null },
        });
      },
    }),
  },
  {
    id: 'artifact.runAgain',
    label: 'Run again',
    icon: RotateCw,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => planIn({ facts, statuses: ['consumed', 'superseded'] }),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'runAgain' }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'runAgain' }),
    confirm: () => ({
      title: 'Run this plan again?',
      description: 'It already ran once. Running it again starts a new agent.',
      confirmLabel: 'Run again',
      role: 'alert',
    }),
    run: ported({ id: 'runAgain', fallback: runPlan }),
  },
  {
    id: 'artifact.restore',
    label: 'Restore',
    icon: ArchiveRestore,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => isStored({ facts }) && isDeleted({ facts }),
    run: ported({
      id: 'restore',
      fallback: async ({ facts, env }) => {
        const artifactId = idOf({ facts });
        if (artifactId !== null) {
          await env.getState().restoreArtifact({ sessionId: facts.sessionId, artifactId });
        }
      },
    }),
  },
  {
    id: 'artifact.regenerate',
    label: 'Regenerate',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.kind === 'report' && isLiveStored({ facts }),
    description: ({ facts }) => (facts.kickoff === null ? null : REGENERATE_READY_HINT),
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'regenerate' }) ??
      (facts.kickoff === null ? sentence(REGENERATE_BLOCKED_HINT) : null),
    isBusy: ({ facts }) => portBusy({ facts, id: 'regenerate' }),
    run: ported({
      id: 'regenerate',
      fallback: async ({ facts, env }) => {
        const report = reportOf({ facts });
        if (report !== null && facts.kickoff !== null) {
          await regenerateReport({
            getState: env.getState,
            sessionId: facts.sessionId,
            artifact: report,
            kickoff: facts.kickoff,
          });
        }
      },
    }),
  },
  {
    id: 'artifact.newVariant',
    label: 'New variant',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.kind === 'wireframe' && isLiveStored({ facts }),
    description: ({ facts }) => wireframeDescription({ artifact: wireframeOf({ facts }) }),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'newVariant' }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'newVariant' }),
    run: ported({
      id: 'newVariant',
      fallback: async ({ facts, env }) => {
        const wireframe = wireframeOf({ facts });
        if (wireframe !== null) {
          await spawnWireframeVariant({
            getState: env.getState,
            sessionId: facts.sessionId,
            artifact: wireframe,
          });
        }
      },
    }),
  },
  {
    id: 'artifact.stop',
    label: 'Stop',
    icon: Square,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => facts.generation?.canStop === true,
    run: async ({ facts, env }) => {
      if (facts.generation !== null) {
        await env.getState().stopArtifactGeneration({
          sessionId: facts.sessionId,
          agentId: facts.generation.agentId,
        });
      }
    },
  },
  {
    id: 'artifact.retry',
    label: NAMES.retry,
    icon: RotateCcw,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => facts.generation?.state === 'unproduced',
    run: async ({ facts, env }) => {
      if (facts.generation !== null) {
        await retryArtifactGeneration({
          getState: env.getState,
          sessionId: facts.sessionId,
          generation: facts.generation,
        });
      }
    },
  },
  {
    id: 'artifact.copySource',
    label: ({ facts }) =>
      portLabel({
        facts,
        id: 'copySource',
        fallback:
          facts.kind === 'wireframe'
            ? 'Copy spec'
            : facts.stored?.sourceFormat === 'json'
              ? 'Copy JSON'
              : 'Copy markdown',
      }),
    icon: Copy,
    group: 'copy',
    when: isStored,
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'copySource' }),
    run: ported({
      id: 'copySource',
      fallback: ({ facts, env }) => {
        const artifact = artifactOf({ facts });
        return artifact === null
          ? undefined
          : env.copyText({ text: artifactSourceContents({ artifact }) });
      },
    }),
  },
  {
    id: 'artifact.saveSource',
    label: ({ facts }) =>
      portLabel({
        facts,
        id: 'saveSource',
        fallback:
          facts.kind === 'wireframe'
            ? 'Save a copy to…'
            : `${artifactSourceExport({ sourceFormat: artifactOf({ facts })?.sourceFormat ?? 'markdown' }).actionLabel} to…`,
      }),
    icon: FileDown,
    group: 'copy',
    when: isStored,
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'saveSource' }),
    run: ported({
      id: 'saveSource',
      fallback: async ({ facts, env }) => {
        const artifact = artifactOf({ facts });
        if (artifact === null) {
          return;
        }
        const path = await saveArtifactSource({ artifact });
        if (path !== null) {
          env.showToast({ kind: 'success', title: 'Saved a copy', message: path });
        }
      },
    }),
  },
  {
    id: 'artifact.openInBrowser',
    label: 'Open in browser',
    icon: ExternalLink,
    group: 'copy',
    slot: ({ facts }) => (facts.kind === 'wireframe' ? 'secondary' : 'menu'),
    when: isStored,
    description: ({ facts }) =>
      portOf({ facts, id: 'openInBrowser' })?.description ??
      (facts.kind === 'wireframe'
        ? 'Opens the saved folder in your browser'
        : 'Opens the saved file. Print it from there as a PDF.'),
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'openInBrowser' }) ?? noCopyReason({ facts }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'openInBrowser' }),
    run: ported({
      id: 'openInBrowser',
      fallback: ({ facts }) => {
        const artifact = artifactOf({ facts });
        return artifact === null || facts.workspaceSlug === null
          ? undefined
          : openArtifactCopy({ artifact, workspaceSlug: facts.workspaceSlug });
      },
    }),
  },
  {
    id: 'artifact.showInFinder',
    label: 'Show in Finder',
    icon: FolderOpen,
    group: 'copy',
    when: isStored,
    description: () => 'The copy Goodboy keeps on disk for this artifact',
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'showInFinder' }) ?? noCopyReason({ facts }),
    run: ported({
      id: 'showInFinder',
      fallback: ({ facts }) => {
        const artifact = artifactOf({ facts });
        return artifact === null || facts.workspaceSlug === null
          ? undefined
          : revealArtifactCopy({ artifact, workspaceSlug: facts.workspaceSlug });
      },
    }),
  },
  {
    id: 'artifact.delete',
    label: 'Delete',
    icon: Trash2,
    group: 'danger',
    slot: () => 'inline',
    isUndoable: true,
    description: () => 'Moves it to Recently deleted. Restore it any time.',
    when: ({ facts }) => isLiveStored({ facts }),
    run: ported({
      id: 'delete',
      fallback: async ({ facts, env }) => {
        const artifactId = idOf({ facts });
        if (artifactId === null) {
          return;
        }
        const { sessionId, title } = facts;
        const previous = await env.getState().deleteArtifact({ sessionId, artifactId });
        if (previous === null) {
          return;
        }
        env.getState().undoable({
          showToast: env.showToast,
          title: `Deleted "${title}"`,
          message: 'It moved to Recently deleted.',
          undo: async () => {
            await env.getState().restoreArtifact({ sessionId, artifactId, status: previous });
          },
        });
      },
    }),
  },
  {
    id: 'artifact.deletePermanently',
    label: 'Delete permanently',
    icon: Trash2,
    group: 'danger',
    slot: () => 'inline',
    when: ({ facts }) => isStored({ facts }) && isDeleted({ facts }),
    confirm: ({ facts }) => {
      const history = runHistoryOf({ facts });
      return {
        title: `Delete "${facts.title}" for good?`,
        description:
          history === null
            ? 'It is removed from this device. This cannot be undone.'
            : `It is removed from this device, with its run history (${history}). This cannot be undone.`,
        confirmLabel: 'Delete permanently',
        role: 'danger',
      };
    },
    run: async ({ facts, env }) => {
      const artifactId = idOf({ facts });
      if (artifactId !== null) {
        await env.getState().deleteArtifactPermanently({ sessionId: facts.sessionId, artifactId });
      }
    },
  },
];

export const ARTIFACT_KIND: ObjectKindDefinition<ArtifactActionTarget, ArtifactFacts> = {
  noun: 'artifact',
  facts: ({ state, target }) => {
    const session = sessionById(state.sessions, target.sessionId) ?? null;
    const workspaceSlug =
      state.workspaces.find((workspace) => workspace.id === session?.workspaceId)?.slug ?? null;
    const ports = target.ports ?? NO_PORTS;
    if (target.subject.kind === 'generation') {
      const { generation } = target.subject;
      return {
        sessionId: target.sessionId,
        workspaceSlug,
        kind: generation.kind,
        title: generation.title,
        plan: null,
        stored: null,
        planStatus: null,
        status: null,
        isPlanRunning: false,
        planRevising: NOT_REVISING,
        planRun: null,
        planDrafts: NO_DRAFTS,
        plannerQuestionCount: 0,
        generation,
        kickoff: null,
        ports,
      };
    }
    const { artifactId, isPlanRunning } = target.subject;
    const stored =
      (state.sessionArtifacts[target.sessionId] ?? []).find(
        (candidate) => candidate.id === artifactId,
      ) ?? null;
    const plan =
      (state.sessionPlans[target.sessionId] ?? []).find(
        (candidate) => candidate.id === artifactId,
      ) ?? null;
    if (stored === null && plan === null) {
      return null;
    }
    const kind: ArtifactKind = plan === null ? (stored?.kind ?? 'plan') : 'plan';
    return {
      sessionId: target.sessionId,
      workspaceSlug,
      kind,
      title: plan?.title ?? stored?.title ?? '',
      plan,
      stored,
      planStatus: plan?.status ?? (stored?.kind === 'plan' ? stored.status : null),
      status: plan?.status ?? stored?.status ?? null,
      isPlanRunning,
      planRevising:
        stored === null || stored.kind !== 'plan'
          ? NOT_REVISING
          : planRevisingOf({ artifact: stored, turn: state.agentTurnState[stored.agentId] }),
      planRun:
        plan === null || session === null
          ? null
          : planRunOf({
              plan,
              agents: state.sessionPhaseRuns[target.sessionId] ?? NO_AGENTS,
              runs: session.workflowRuns,
              templates: state.phaseTemplates[session.workspaceId] ?? NO_TEMPLATES,
            }),
      planDrafts:
        kind === 'plan'
          ? (state.artifactComments[target.sessionId] ?? NO_DRAFTS).filter(
              (comment) => comment.artifactId === artifactId && comment.status === 'draft',
            )
          : NO_DRAFTS,
      plannerQuestionCount:
        plan === null
          ? 0
          : plannerQuestionsOf({
              questions: state.sessionOpenQuestions[target.sessionId] ?? NO_QUESTIONS,
              plan,
            }).length,
      generation: null,
      kickoff:
        stored?.kind === 'report'
          ? artifactKickoff({ getState: () => state, artifact: stored })
          : null,
      ports,
    };
  },
  actions: ARTIFACT_ACTIONS,
};
