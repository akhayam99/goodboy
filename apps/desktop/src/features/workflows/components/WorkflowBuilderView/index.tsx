import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EmptyLine,
  Button,
  Chip,
  FormPage,
  Notice,
  Switch,
  formatError,
  EmptyState,
} from '@goodboy/ui';
import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  PROVIDER_CAPABILITIES,
  type PlannerOutput,
  clampEffortForModel,
  isAgentStatusHalted,
  runsForWorkflowRun,
} from '@goodboy/core';
import { useResolution } from '../../../providers/hooks/useResolution';
import { autoModelOn } from '../../../providers/autoModelOn';
import { modelOnProvider, roleResolutionOf } from '../../../providers/roleResolution';
import { resolutionAsTask } from '../../../providers/resolutionAsTask';
import type {
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Session,
  Workflow,
  WorkflowExecutionMode,
  WorkflowId,
  WorkflowSpendLimitMode,
  WorkspaceId,
  WorkflowAutonomy,
  WorkflowRules,
  AgentRole,
} from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { createWorkflowPlanner, polishWorkflowGoalText } from '../../workflows';
import { usePolish } from '../../hooks/usePolish';
import { useStepDeleteUndo } from '../../hooks/useStepDeleteUndo';
import { stepPolishFields } from '../../stepPolishFields';
import { EMPTY_ARRAY, useAppStore, useSessionSlots } from '../../../../store';
import { buildProfileGuard } from '../../../../store/slices/turn/profileGuard';
import { buildWorkspaceProjectsBlock } from '../../../../store/slices/workflows/buildWorkspaceProjectsBlock';
import { workflowStartGate } from './workflowStartGate';
import { readLastWorkflowMode, writeLastWorkflowMode } from './lastWorkflowMode';
import { editedStepKeys, stepsMatchPreset } from './presetEdits';
import type {
  KickoffLane,
  Mode,
  WorkflowBuilderDraft,
  WorkflowDraftKey,
} from '../../../../store/slices/workflowDrafts/types';
import { kickoffDraftKey } from '../../../../store/slices/workflowDrafts/kickoffDraftKey';
import type { StepDraft, WorkflowDraft } from '../../engine';
import {
  addStep as addDraftStep,
  blankStepDraft,
  draftFromPlannerSteps,
  draftFromWorkflow,
  duplicateStep as duplicateDraftStep,
  reorderSteps as reorderDraftSteps,
  updateStep as updateDraftStep,
  upsertArgsFromDraft,
} from '../../engine';
import { useWorkflowDraft } from '../../engine/useWorkflowDraft';
import { ROLE_LABEL, classifyStep } from '../../../session/agent-kind';
import { isWorkflowRunComplete } from '../../isWorkflowRunComplete';
import { isPresetWorkflow } from '../../isPresetWorkflow';
import { useWorkflowDrag } from '../../../../shared/hooks/useWorkflowDrag';
import { useSaveAsStep } from '../../hooks/useSaveAsStep';
import { useSavedSteps } from '../../hooks/useSavedSteps';
import { stepDraftFromSavedStep, type SavedStep } from '../../savedSteps';
import { parseSpendLimit } from '../../../budget/parseSpendLimit';
import { DragGhost } from '../WorkflowStudio/DragGhost';
import { useToast } from '../../../../shared/components/Toast';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { runIdentity, runIdentitySeed } from '../../../session/timeline/runIdentity';
import { BuilderTitleField } from './parts/BuilderTitleField';
import { GoalField } from './parts/GoalField';
import { LaunchBar } from './parts/LaunchBar';
import { ModeSwitch } from './parts/ModeSwitch';
import { ProviderPoolChip } from './parts/ProviderPoolChip';
import { effectiveProviderPool } from './providerPool';
import { PlanDraftingBanner } from './parts/PlanDraftingBanner';
import { PresetPicker } from './parts/PresetPicker';
import { SpendCapChip } from './parts/SpendCapChip';
import { AutonomyChip } from './parts/AutonomyChip';
import { FromRulesRow } from './parts/FromRulesRow';
import { GuidanceTools } from './parts/GuidanceTools';
import { RuleDot } from './parts/RuleDot';
import { RunGuidanceField } from './parts/RunGuidanceField';
import { GuidanceRecipients } from '../WorkflowGuidance/GuidanceRecipients';
import { usePolishGuidance } from '../../hooks/usePolishGuidance';
import { guidanceRoleNames, sameRoles } from '../../guidanceRoles';
import { useWorkflowRules } from '../../hooks/useWorkflowRules';
import { StartsChip, type ChainRun, type StartChoice } from './parts/StartsChip';
import { StepTree } from '../StepTree';
import { StepEditor } from '../StepTree/StepEditor';
import { StepRow } from '../StepTree/StepRow';
import { OrchestratorRow } from './parts/OrchestratorRow';
import { PlannerDraftRow } from './parts/PlannerDraftRow';
import { PlanEstimateChip } from './parts/PlanEstimateChip';
import { usePlanEstimates } from './usePlanEstimates';

export type BuilderKickoff = {
  readonly workspaceId: WorkspaceId;
  readonly lane?: KickoffLane;
  readonly goal: string;
  readonly goalPlaceholder: string;
  readonly primaryLabel?: string;
  readonly onGoalChange: (goal: string) => void;
  readonly start: (run: (session: Session) => Promise<void>) => Promise<void>;
};

type Props =
  | { readonly session: Session; readonly kickoff?: never; readonly onClose: () => void }
  | { readonly kickoff: BuilderKickoff; readonly session?: never; readonly onClose?: never };

type ProviderEntry = { readonly id: ProviderId; readonly connection: string };

type BuilderError = {
  readonly title: string;
  readonly message: string;
};

type StepsFromPlanParams = {
  readonly plan: PlannerOutput;
  readonly roleModels: RoleModelPreferences | null;
};

const stepsFromPlan = ({ plan, roleModels }: StepsFromPlanParams): ReadonlyArray<StepDraft> =>
  draftFromPlannerSteps({ steps: plan.steps }).map((step) => ({
    ...step,
    effort: roleResolutionOf({ role: step.role, roleModels }).effort ?? 'medium',
  }));

const isDraftEmpty = (d: WorkflowBuilderDraft, rules: WorkflowRules): boolean =>
  d.goalText.trim() === '' &&
  d.goalHistory.length === 0 &&
  d.selectedPresetId === null &&
  d.basePresetId === null &&
  d.processText.trim() === '' &&
  d.plan === null &&
  d.workflow.steps.length === 0 &&
  !d.saveAsPreset &&
  (d.autonomy ?? rules.autonomy) === rules.autonomy &&
  (d.guidance ?? rules.standingGuidance) === rules.standingGuidance &&
  sameRoles({ left: d.guidanceRoles ?? rules.guidanceRoles, right: rules.guidanceRoles }) &&
  d.title.trim() === '' &&
  d.orchestratorModel.providerOverride === '' &&
  d.orchestratorModel.modelOverride === '' &&
  d.orchestratorModel.effortOverride === null &&
  d.providerPool === null;

const PLANNER_EFFORT: EffortLevel = roleResolutionOf({ role: 'planner' }).effort ?? 'medium';
const ORCHESTRATOR_EFFORT: EffortLevel = 'medium';
const DYNAMIC_EXECUTION_MODE: WorkflowExecutionMode = 'dynamic';
const DYNAMIC_WORKFLOW_NAME = 'Orchestrated workflow';
const CUSTOM_WORKFLOW_NAME = 'Custom workflow';
const IMMEDIATE_START: StartChoice = { triggerMode: 'immediate', chainAfterId: null };

export const uniqueWorkflowName = (
  requested: string,
  existing: ReadonlyArray<Workflow>,
): string => {
  const names = new Set(existing.filter((t) => !t.deletedAt).map((t) => t.name));
  if (!names.has(requested)) {
    return requested;
  }
  let suffix = 2;
  while (names.has(`${requested} ${suffix}`)) {
    suffix += 1;
  }
  return `${requested} ${suffix}`;
};

export const WorkflowBuilderView = (props: Props) => {
  const session = props.session ?? null;
  const kickoff = props.kickoff ?? null;
  const workspaceId: WorkspaceId =
    props.session !== undefined ? props.session.workspaceId : props.kickoff.workspaceId;
  const draftKey: WorkflowDraftKey =
    props.session !== undefined
      ? props.session.id
      : kickoffDraftKey({ workspaceId, lane: props.kickoff.lane ?? 'workflow' });
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const generateWorkflowTitle = useAppStore((s) => s.generateWorkflowTitle);
  const suggestWorkflowTitle = useAppStore((s) => s.suggestWorkflowTitle);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionPhaseRuns = useAppStore(
    (s) =>
      (session === null ? undefined : s.sessionPhaseRuns?.[session.id]) ??
      (EMPTY_ARRAY as ReadonlyArray<never>),
  );
  const providers = useAppStore(
    (s) => s.providers ?? (EMPTY_ARRAY as ReadonlyArray<never>),
  ) as ReadonlyArray<ProviderEntry>;
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides?.[workspaceId] ?? null);
  const { rules: workflowRules, patch: patchWorkflowRules } = useWorkflowRules({ workspaceId });
  const roleModels = workspaceOverrides?.roleModels ?? null;
  const roleEffort = (role: StepDraft['role']): EffortLevel =>
    roleResolutionOf({ role, roleModels }).effort ?? 'medium';
  const setWorkflowDraft = useAppStore((s) => s.setWorkflowDraft);
  const clearWorkflowDraft = useAppStore((s) => s.clearWorkflowDraft);
  const sessionSlots = useSessionSlots(session?.id ?? null);
  const sessionWorktree = useSessionRepo({ sessionId: session?.id ?? null })?.worktreePath ?? null;
  const { showToast } = useToast();

  const goalFiles = usePromptFiles({ note: 'Files go to the agents of this run' });
  const attachments = goalFiles.attachments;

  const presets = phaseTemplates.filter(isPresetWorkflow);

  const [initialDraft] = useState(() => useAppStore.getState().workflowDrafts[draftKey]);

  const defaultMode = (): Mode => {
    const last = readLastWorkflowMode({ workspaceId });
    return last === 'preset' && presets.length === 0 ? 'dynamic' : last;
  };

  const [mode, setMode] = useState<Mode>(() => initialDraft?.mode ?? defaultMode());
  const [localGoal, setLocalGoal] = useState(initialDraft?.goalText ?? '');
  const goalText = kickoff?.goal ?? localGoal;
  const setGoalText = kickoff?.onGoalChange ?? setLocalGoal;
  const [goalHistory, setGoalHistory] = useState<ReadonlyArray<string>>(
    initialDraft?.goalHistory ?? [],
  );
  const [polishing, setPolishing] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<WorkflowId | null>(
    initialDraft?.selectedPresetId ?? null,
  );
  const [basePresetId, setBasePresetId] = useState<WorkflowId | null>(
    initialDraft?.basePresetId ?? null,
  );
  const [processText, setProcessText] = useState(initialDraft?.processText ?? '');
  const [guidance, setGuidance] = useState(
    initialDraft?.guidance ?? workflowRules.standingGuidance,
  );
  const [guidanceRoles, setGuidanceRoles] = useState<ReadonlyArray<AgentRole>>(
    initialDraft?.guidanceRoles ?? workflowRules.guidanceRoles,
  );
  const [guidanceUndo, setGuidanceUndo] = useState<string | null>(null);
  const { polish: polishGuidance, isPolishing: isPolishingGuidance } = usePolishGuidance({
    workspaceId,
    workingDir: sessionWorktree,
  });
  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [titleSuggestion, setTitleSuggestion] = useState<string | null>(null);
  const suggestedGoalRef = useRef<string | null>(null);
  const latestGoalRef = useRef(goalText);
  latestGoalRef.current = goalText;
  const [plan, setPlan] = useState<PlannerOutput | null>(initialDraft?.plan ?? null);
  const initialWorkflowDraft: WorkflowDraft = initialDraft?.workflow ?? {
    name: '',
    description: '',
    goal: '',
    processText: '',
    steps: [],
    origin: 'custom',
    isPreset: false,
  };
  const { draft: authoringDraft, setDraft: setAuthoringDraft } = useWorkflowDraft({
    initial: initialWorkflowDraft,
  });
  const steps = authoringDraft.steps;
  const setSteps = (updater: React.SetStateAction<ReadonlyArray<StepDraft>>) => {
    setAuthoringDraft((current) => ({
      ...current,
      steps: typeof updater === 'function' ? updater(current.steps) : updater,
    }));
  };
  const [isPlannerOpen, setIsPlannerOpen] = useState(
    () => initialWorkflowDraft.steps.length === 0 || (initialDraft?.processText ?? '') !== '',
  );
  const [planning, setPlanning] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saveAsPreset, setSaveAsPreset] = useState(initialDraft?.saveAsPreset ?? false);
  const [autonomyOverride, setAutonomyOverride] = useState<WorkflowAutonomy | null>(
    initialDraft?.autonomy ?? null,
  );
  const autonomy = autonomyOverride ?? workflowRules.autonomy;
  const autoRun = autonomy !== 'step';
  const chooseAutonomy = (next: WorkflowAutonomy) =>
    setAutonomyOverride(next === workflowRules.autonomy ? null : next);
  const [startChoice, setStartChoice] = useState<StartChoice>(IMMEDIATE_START);
  const [isSpendLimitEnabled, setIsSpendLimitEnabled] = useState(
    workflowRules.spendLimitUsd !== null,
  );
  const [spendLimitDraft, setSpendLimitDraft] = useState(
    workflowRules.spendLimitUsd?.toString() ?? '',
  );
  const [spendLimitMode, setSpendLimitMode] = useState<WorkflowSpendLimitMode>(
    workflowRules.spendLimitMode,
  );
  const [orchestratorProviderOverride, setOrchestratorProviderOverride] = useState<ProviderId | ''>(
    initialDraft?.orchestratorModel.providerOverride ?? '',
  );
  const [orchestratorModelOverride, setOrchestratorModelOverride] = useState(
    initialDraft?.orchestratorModel.modelOverride ?? '',
  );
  const [orchestratorEffortOverride, setOrchestratorEffortOverride] = useState<EffortLevel | null>(
    initialDraft?.orchestratorModel.effortOverride ?? null,
  );
  const [providerPool, setProviderPool] = useState<ReadonlyArray<ProviderId> | null>(
    initialDraft?.providerPool ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BuilderError | null>(null);
  const [plannerProviderOverride, setPlannerProviderOverride] = useState<ProviderId | ''>('');
  const [plannerModelOverride, setPlannerModelOverride] = useState('');
  const [plannerEffortOverride, setPlannerEffortOverride] = useState<EffortLevel | null>(null);

  const providerId: ProviderId =
    session === null
      ? (workspaceOverrides?.defaultProviderId ??
        DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider)
      : (providers.find((p) => p.id === session.providerOverride)?.id ??
        session.providerPreference.defaultProvider);

  const connectedProviders = useMemo<ReadonlyArray<ProviderId>>(
    () => providers.filter((p) => p.connection === 'connected').map((p) => p.id),
    [providers],
  );

  const resolutionScope = session === null ? { workspaceId } : { sessionId: session.id };
  const planResolution = useResolution({ task: 'plan_generation', ...resolutionScope });
  const resolvedPlanTaskModel = useMemo(
    () => resolutionAsTask({ resolution: planResolution }),
    [planResolution],
  );

  const prosePolishResolution = useResolution({ task: 'prose_polish', ...resolutionScope });
  const resolvedProsePolishTaskModel = useMemo(
    () => resolutionAsTask({ resolution: prosePolishResolution }),
    [prosePolishResolution],
  );

  const plannerEffectiveProviderId: ProviderId =
    plannerProviderOverride !== '' ? plannerProviderOverride : resolvedPlanTaskModel.providerId;

  const plannerRecommendedModel = useMemo(
    () =>
      plannerProviderOverride !== ''
        ? autoModelOn({
            slot: { kind: 'task', id: 'plan_generation' },
            provider: plannerProviderOverride,
          }).model
        : resolvedPlanTaskModel.model,
    [plannerProviderOverride, providerId, resolvedPlanTaskModel],
  );

  const plannerEffort = plannerEffortOverride ?? resolvedPlanTaskModel.effort ?? PLANNER_EFFORT;

  const orchestratorResolution = useResolution({
    task: 'workflow_orchestrator',
    ...resolutionScope,
  });
  const resolvedOrchestratorTaskModel = useMemo(
    () => resolutionAsTask({ resolution: orchestratorResolution }),
    [orchestratorResolution],
  );

  const workspacePolicy = workspaceOverrides?.providerPool ?? null;
  const orchestratorProviders = useMemo<ReadonlyArray<ProviderId>>(() => {
    const capable = connectedProviders.filter(
      (candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0,
    );
    if (workspacePolicy === null) {
      return capable;
    }
    return workspacePolicy
      .filter((entry) => entry.state !== 'off' && capable.includes(entry.id))
      .map((entry) => entry.id);
  }, [connectedProviders, workspacePolicy]);
  const effectivePool = effectiveProviderPool({
    providers: orchestratorProviders,
    pool: providerPool,
  });

  const orchestratorEffectiveProviderId: ProviderId =
    orchestratorProviderOverride !== ''
      ? orchestratorProviderOverride
      : resolvedOrchestratorTaskModel.providerId;

  const recommendedOrchestratorModel = useMemo(
    () =>
      orchestratorProviderOverride !== ''
        ? autoModelOn({
            slot: { kind: 'task', id: 'workflow_orchestrator' },
            provider: orchestratorProviderOverride,
          }).model
        : resolvedOrchestratorTaskModel.model,
    [orchestratorProviderOverride, resolvedOrchestratorTaskModel],
  );

  const orchestratorEffectiveModel =
    orchestratorModelOverride !== '' ? orchestratorModelOverride : recommendedOrchestratorModel;
  const requestedOrchestratorEffort =
    orchestratorEffortOverride ?? resolvedOrchestratorTaskModel.effort ?? ORCHESTRATOR_EFFORT;
  const orchestratorEffort =
    clampEffortForModel({
      model: orchestratorEffectiveModel,
      effort: requestedOrchestratorEffort,
      provider:
        orchestratorProviderOverride !== ''
          ? orchestratorProviderOverride
          : resolvedOrchestratorTaskModel.providerId,
    }) ?? requestedOrchestratorEffort;
  const isOrchestratorOverridden =
    orchestratorProviderOverride !== '' ||
    orchestratorModelOverride !== '' ||
    orchestratorEffortOverride !== null;

  const basePreset = useMemo(
    () => (basePresetId ? (presets.find((t) => t.id === basePresetId) ?? null) : null),
    [basePresetId, presets],
  );
  const presetDirty = useMemo(
    () => (basePreset ? !stepsMatchPreset({ steps, preset: basePreset }) : false),
    [basePreset, steps],
  );
  const editedKeys = useMemo(
    () => (basePreset ? editedStepKeys({ steps, preset: basePreset }) : new Set<string>()),
    [basePreset, steps],
  );

  const activeRuns = useMemo<ReadonlyArray<ChainRun & { readonly ordinal: number }>>(() => {
    const runs = session?.workflowRuns ?? [];
    return runs
      .filter((r) => !r.discardedAt)
      .flatMap((r) => {
        const template = phaseTemplates.find((t) => t.id === r.workflowId) ?? null;
        if (template === null) {
          return [];
        }
        const agents = runsForWorkflowRun(sessionPhaseRuns, r.id);
        const complete = isWorkflowRunComplete({ run: r, workflow: template, agents });
        const failed = agents.some((a) => isAgentStatusHalted({ status: a.status }));
        return complete || failed ? [] : [{ run: r, template, ordinal: r.ordinal }];
      })
      .sort((a, b) => a.ordinal - b.ordinal);
  }, [session?.workflowRuns, phaseTemplates, sessionPhaseRuns]);

  useEffect(() => {
    if (startChoice.triggerMode !== 'after_run') {
      return;
    }
    if (activeRuns.some((entry) => entry.run.id === startChoice.chainAfterId)) {
      return;
    }
    setStartChoice(IMMEDIATE_START);
  }, [activeRuns, startChoice]);

  const identityIndex = runIdentity({
    laneIndex: (session?.workflowRuns ?? []).filter((r) => r.createdAt != null).length,
    seed: runIdentitySeed({ sessionId: draftKey }),
  }).index;

  const draft: WorkflowBuilderDraft = {
    mode,
    goalText,
    goalHistory,
    selectedPresetId,
    basePresetId,
    processText,
    guidance,
    guidanceRoles,
    plan,
    workflow: {
      name: plan?.workflowName ?? '',
      description: plan?.reasoning ?? '',
      goal: goalText,
      steps,
      origin: 'custom',
      isPreset: saveAsPreset,
    },
    saveAsPreset,
    autoRun,
    ...(autonomyOverride !== null && { autonomy: autonomyOverride }),
    title,
    orchestratorModel: {
      providerOverride: orchestratorProviderOverride,
      modelOverride: orchestratorModelOverride,
      effortOverride: orchestratorEffortOverride,
    },
    providerPool,
  };
  const draftEmpty = isDraftEmpty(draft, workflowRules);

  useEffect(() => {
    if (draftEmpty) {
      clearWorkflowDraft(draftKey);
    } else {
      setWorkflowDraft(draftKey, draft);
    }
  }, [
    draftKey,
    mode,
    goalText,
    goalHistory,
    selectedPresetId,
    basePresetId,
    processText,
    guidance,
    guidanceRoles,
    plan,
    steps,
    saveAsPreset,
    autoRun,
    autonomyOverride,
    title,
    orchestratorProviderOverride,
    orchestratorModelOverride,
    orchestratorEffortOverride,
    providerPool,
  ]);

  const resetOrchestratorModel = () => {
    setOrchestratorProviderOverride('');
    setOrchestratorModelOverride('');
    setOrchestratorEffortOverride(null);
  };

  const resetDraft = () => {
    setMode(defaultMode());
    setGoalText('');
    setGoalHistory([]);
    setSelectedPresetId(null);
    setBasePresetId(null);
    setProcessText('');
    setGuidance(workflowRules.standingGuidance);
    setGuidanceRoles(workflowRules.guidanceRoles);
    setGuidanceUndo(null);
    setPlan(null);
    setSteps([]);
    setIsPlannerOpen(true);
    setSaveAsPreset(false);
    setAutonomyOverride(null);
    setTitle('');
    setTitleSuggestion(null);
    suggestedGoalRef.current = null;
    resetOrchestratorModel();
    setProviderPool(null);
    setStartChoice(IMMEDIATE_START);
    setIsSpendLimitEnabled(workflowRules.spendLimitUsd !== null);
    setSpendLimitDraft(workflowRules.spendLimitUsd?.toString() ?? '');
    setSpendLimitMode(workflowRules.spendLimitMode);
    setError(null);
    setExpandedKey(null);
    clearWorkflowDraft(draftKey);
  };

  const handleClose = () => {
    clearWorkflowDraft(draftKey);
    props.onClose?.();
  };

  const blocked = busy || planning;

  const requestTitleSuggestion = (goal: string) => {
    const trimmed = goal.trim();
    if (session === null || trimmed === '' || trimmed === suggestedGoalRef.current) {
      return;
    }
    suggestedGoalRef.current = trimmed;
    void suggestWorkflowTitle(session.id, trimmed).then((suggestion) => {
      if (latestGoalRef.current.trim() !== trimmed) {
        return;
      }
      setTitleSuggestion(suggestion);
    });
  };

  const onGoalChange = (next: string) => {
    setGoalText(next);
    if (next.trim() === '') {
      setTitleSuggestion(null);
      suggestedGoalRef.current = null;
    }
  };

  const patchStep = (key: string, patch: Partial<StepDraft>) =>
    setSteps((previous) => updateDraftStep({ steps: previous, key, patch }));

  const moveStep = (key: string, dir: -1 | 1) =>
    setSteps((previous) => {
      const i = previous.findIndex((step) => step.key === key);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= previous.length) {
        return previous;
      }
      return reorderDraftSteps({ steps: previous, from: i, to: j + (dir > 0 ? 1 : 0) });
    });

  const moveStepTo = (from: number, to: number) => {
    if (to === from || to === from + 1) {
      return;
    }
    setSteps((previous) => reorderDraftSteps({ steps: previous, from, to }));
  };

  const savedSteps = useSavedSteps({ workspaceId });
  const addStep = (picked: SavedStep | null) => {
    const step = picked === null ? blankStepDraft() : stepDraftFromSavedStep({ step: picked });
    setSteps((previous) => addDraftStep({ steps: previous, step }));
    setExpandedKey(step.key);
  };
  const { savingKey, saveAsStep } = useSaveAsStep({
    workspaceId,
    onLinked: (key, libraryStepId) => patchStep(key, { libraryStepId }),
    onError: (message) => setError({ title: "Couldn't save the step", message }),
  });

  const { drag, dropIndex, startStepDrag, ghost } = useWorkflowDrag({
    enabled: steps.length > 0,
    onReorder: moveStepTo,
  });
  const isDraggingStep = drag !== null;
  const draggingKey = drag?.kind === 'step' ? (steps[drag.fromIndex]?.key ?? null) : null;

  const resolvedProvider = (step: StepDraft): ProviderId =>
    step.provider !== '' ? step.provider : providerId;
  const recommendedModel = (step: StepDraft): string =>
    modelOnProvider({
      role: step.role ?? 'custom',
      provider: resolvedProvider(step),
      roleModels,
    });
  const resolvedModel = (step: StepDraft): string =>
    step.model !== '' ? step.model : recommendedModel(step);

  const stepPolish = usePolish({
    onError: (message) => setError({ title: "Couldn't polish the step", message }),
  });
  const stepPolishDeps = {
    ...resolvedProsePolishTaskModel,
    ...(sessionWorktree != null && { workingDir: sessionWorktree }),
  };
  const deleteStep = useStepDeleteUndo({
    steps,
    setSteps,
    contextKey: selectedPresetId,
    onDeleted: (key) => setExpandedKey((cur) => (cur === key ? null : cur)),
  });

  const sessionGoal = (sessionSlots.find((s) => s.key === 'goal')?.value ?? '').trim();
  const selectedPreset = presets.find((t) => t.id === selectedPresetId) ?? null;

  const replaceGoal = (next: string) => {
    setGoalHistory((h) => [...h, goalText]);
    setGoalText(next);
    requestTitleSuggestion(next);
  };

  const onUseSessionGoal = () => {
    if (sessionGoal.length === 0 || goalText === sessionGoal) {
      return;
    }
    replaceGoal(sessionGoal);
  };

  const onUndoGoal = () => {
    const prev = goalHistory[goalHistory.length - 1];
    if (prev === undefined) {
      return;
    }
    setGoalText(prev);
    setGoalHistory((h) => h.slice(0, -1));
  };

  const onPolishGoal = async () => {
    if (goalText.trim().length === 0 || polishing) {
      return;
    }
    setError(null);
    setPolishing(true);
    try {
      const polished = await polishWorkflowGoalText({
        deps: {
          ...resolvedProsePolishTaskModel,
          ...(sessionWorktree != null && { workingDir: sessionWorktree }),
        },
        goal: goalText,
      });
      if (polished && polished !== goalText) {
        replaceGoal(polished);
        return;
      }
      if (!polished) {
        showToast({
          kind: 'warning',
          message: "Kept your wording. Couldn't polish the goal.",
        });
      }
    } catch (err) {
      setError({ title: "Couldn't polish the goal", message: formatError(err) });
    } finally {
      setPolishing(false);
    }
  };

  const onSelectPreset = (t: Workflow) => {
    setSelectedPresetId(t.id);
    setBasePresetId(t.id);
    setSteps(draftFromWorkflow({ workflow: t }).steps);
    setExpandedKey(null);
  };

  const onDeletePreset = async (t: Workflow) => {
    setError(null);
    try {
      await deleteWorkflow(t.id, workspaceId);
      if (selectedPresetId === t.id) {
        setSelectedPresetId(null);
        setBasePresetId(null);
        setSteps([]);
        setExpandedKey(null);
      }
      showToast({ kind: 'success', message: `Deleted the ${t.name} preset.` });
    } catch (err) {
      setError({ title: "Couldn't delete the preset", message: formatError(err) });
    }
  };

  const attachOptions = async () => {
    const attachmentInputs = await toAttachmentInputs(attachments);
    const goal = goalText.trim();
    const { triggerMode, chainAfterId } = startChoice;
    const spendLimitUsd = isSpendLimitEnabled ? parseSpendLimit(spendLimitDraft) : null;
    return {
      autoRun,
      navigate: true,
      ...(goal.length > 0 && { goal }),
      ...(triggerMode !== 'immediate' && { triggerMode }),
      ...(triggerMode === 'after_run' && chainAfterId !== null && { chainAfterId }),
      ...(attachmentInputs.length > 0 && { attachmentInputs }),
      ...(mode === 'dynamic' && {
        executionMode: DYNAMIC_EXECUTION_MODE,
      }),
      ...(mode === 'dynamic' &&
        isOrchestratorOverridden && {
          orchestratorRouting: {
            providerId: orchestratorEffectiveProviderId,
            model: orchestratorEffectiveModel,
            effort: orchestratorEffort,
          },
        }),
      ...(spendLimitUsd != null && { spendLimitUsd, spendLimitMode }),
      ...(mode === 'dynamic' && effectivePool !== null && { providerPool: effectivePool }),
      rulesSnapshot: {
        ...workflowRules,
        autonomy,
        spendLimitUsd,
        spendLimitMode,
        standingGuidance: guidance.trim(),
        guidanceRoles,
      },
    };
  };

  const onPlan = async () => {
    const process = processText.trim();
    if (process.length === 0 || blocked) {
      return;
    }
    setError(null);
    setPlanning(true);
    try {
      const effectiveModel =
        plannerModelOverride !== '' ? plannerModelOverride : plannerRecommendedModel;
      const client = createWorkflowPlanner({
        deps: {
          providerId: plannerEffectiveProviderId,
          model: effectiveModel,
          effort: plannerEffort,
          ...(sessionWorktree != null && { workingDir: sessionWorktree }),
        },
      });
      const storeState = useAppStore.getState();
      const profileBlock = buildProfileGuard({
        profile: storeState.workspaces.find((candidate) => candidate.id === workspaceId)?.profile,
        audience: 'planner',
      });
      const projectsBlock = buildWorkspaceProjectsBlock({
        projects: storeState.projects.filter((project) => project.workspaceId === workspaceId),
      });
      const repoContext = [profileBlock, projectsBlock].filter((block) => block !== '').join('\n');
      const result = await client.plan({
        process,
        ...(repoContext.length > 0 && { repoContext }),
      });
      const planned = stepsFromPlan({ plan: result.output, roleModels });
      if (planned.length === 0) {
        setError({
          title: 'The planner returned no usable steps',
          message: 'Nothing was replaced. Describe the steps differently and try again.',
        });
        return;
      }
      setPlan(result.output);
      setSteps(planned);
      setBasePresetId(null);
      setExpandedKey(null);
    } catch (err) {
      setError({ title: "Couldn't draft the plan", message: formatError(err) });
    } finally {
      setPlanning(false);
    }
  };

  const presetName = selectedPreset?.name ?? basePreset?.name ?? null;
  const fallbackTitle =
    mode === 'dynamic'
      ? uniqueWorkflowName(DYNAMIC_WORKFLOW_NAME, phaseTemplates)
      : mode === 'custom'
        ? (plan?.workflowName ?? CUSTOM_WORKFLOW_NAME)
        : (presetName ?? CUSTOM_WORKFLOW_NAME);
  const activeSuggestion =
    mode === 'preset' || (mode === 'custom' && plan !== null) ? null : titleSuggestion;
  const defaultTitle = activeSuggestion ?? fallbackTitle;
  const typedTitle = title.trim();
  const resolvedTitle = typedTitle !== '' ? typedTitle : defaultTitle;
  const isPresetRenamed = mode === 'preset' && typedTitle !== '' && typedTitle !== presetName;
  const isPresetEdited = basePreset !== null && (presetDirty || isPresetRenamed);
  const canSaveAsPreset = mode === 'custom' || presetDirty || isPresetRenamed;

  const runOn = async (target: Session): Promise<void> => {
    if (mode === 'preset' && selectedPreset !== null && !presetDirty && !isPresetRenamed) {
      await attachWorkflowToSession(target.id, selectedPreset.id, await attachOptions());
      writeLastWorkflowMode({ workspaceId, mode });
      if (kickoff === null) {
        showToast({ kind: 'success', message: `Started ${selectedPreset.name}.` });
      }
      return;
    }
    const now = new Date().toISOString() as Workflow['createdAt'];
    const workflowId = `wf_builder_${crypto.randomUUID()}` as WorkflowId;
    const name = uniqueWorkflowName(resolvedTitle, phaseTemplates);
    const description =
      mode === 'custom'
        ? (plan?.reasoning ?? '')
        : mode === 'dynamic'
          ? 'Steps are decided at runtime from the latest results.'
          : (selectedPreset?.description ?? basePreset?.description ?? '');
    const goal = goalText.trim();
    const process =
      mode === 'custom' ? processText.trim() : mode === 'dynamic' ? guidance.trim() : '';
    const workflow: Workflow = {
      id: workflowId,
      workspaceId,
      name,
      description,
      ...(goal.length > 0 && { goal }),
      ...(process.length > 0 && { processText: process }),
      steps: [],
      isPreset: mode === 'dynamic' ? false : saveAsPreset,
      origin: mode === 'dynamic' ? 'orchestrated' : 'custom',
      createdAt: now,
      updatedAt: now,
    };
    const saved = await savePhaseTemplate(
      mode === 'dynamic'
        ? workflow
        : {
            ...upsertArgsFromDraft({
              workspaceId,
              id: workflowId,
              draft: {
                name,
                description,
                goal,
                steps: steps.map((step) => ({ ...step, sourceStepId: null })),
                origin: 'custom',
                isPreset: saveAsPreset,
              },
            }),
            ...(process.length > 0 && { processText: process }),
          },
    );
    if (mode === 'dynamic' && typedTitle === '' && activeSuggestion === null) {
      void generateWorkflowTitle(
        workspaceId,
        workflowId,
        target.id,
        saved?.name ?? name,
        goal,
        process,
      );
    }
    await attachWorkflowToSession(target.id, workflowId, await attachOptions());
    writeLastWorkflowMode({ workspaceId, mode });
    if (kickoff === null) {
      showToast({ kind: 'success', message: `Started ${saved?.name ?? name}.` });
    }
  };

  const onStart = async () => {
    if (blocked) {
      return;
    }
    if (
      (mode === 'preset' && selectedPreset === null) ||
      (mode === 'custom' && steps.length === 0)
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await (props.session !== undefined ? runOn(props.session) : props.kickoff.start(runOn));
      handleClose();
    } catch (err) {
      setError({ title: "Couldn't start the run", message: formatError(err) });
    } finally {
      setBusy(false);
    }
  };

  const goalMissing = goalText.trim().length === 0;
  const stepsMissing = mode === 'preset' ? selectedPreset === null : steps.length === 0;
  const spendLimitInvalid =
    mode === 'dynamic' && isSpendLimitEnabled && parseSpendLimit(spendLimitDraft) == null;
  const startGate = workflowStartGate({
    mode,
    isStarting: busy,
    isPlanning: planning,
    hasGoal: !goalMissing,
    hasSteps: !stepsMissing,
    isSpendLimitValid: !spendLimitInvalid,
  });

  const modeControl =
    mode === 'preset' ? (
      presets.length > 0 ? (
        <PresetPicker
          presets={presets}
          selectedId={selectedPresetId}
          disabled={busy}
          onSelect={onSelectPreset}
          onDelete={onDeletePreset}
        />
      ) : null
    ) : mode === 'custom' ? (
      <Button
        size="sm"
        variant={isPlannerOpen ? 'primary' : 'secondary'}
        aria-pressed={isPlannerOpen}
        disabled={blocked}
        onClick={() => setIsPlannerOpen((open) => !open)}
      >
        <CONCEPT_ICONS.enhance size={ICON_SIZE.control} aria-hidden />
        Draft with planner
      </Button>
    ) : orchestratorProviders.length > 0 ? (
      <ProviderPoolChip
        providers={orchestratorProviders}
        pool={effectivePool}
        disabled={blocked}
        onChange={setProviderPool}
      />
    ) : null;

  const estimates = usePlanEstimates({
    workspaceId,
    steps: steps.map((step) => ({
      key: step.key,
      role: step.role ?? 'custom',
      provider: resolvedProvider(step),
      model: resolvedModel(step),
      effort: step.effort ?? roleEffort(step.role),
      size: step.size,
    })),
    isOrchestrated: mode === 'dynamic',
    isReviewed: !autoRun && steps.length > 1,
  });
  const hasStepEstimates =
    estimates !== null &&
    mode !== 'dynamic' &&
    [...estimates.steps.values()].some((estimate) => estimate.note !== null);

  const renderPlanTree = () => (
    <StepTree
      steps={steps}
      editedCount={editedKeys.size}
      identityIndex={identityIndex}
      isPlanning={planning}
      isDragging={isDraggingStep}
      dropIndex={dropIndex}
      disabled={blocked}
      banner={planning && steps.length > 0 ? <PlanDraftingBanner /> : null}
      savedSteps={savedSteps}
      onAddStep={addStep}
      renderStep={({ step, index, span }) => {
        const effort = step.effort ?? roleEffort(step.role);
        return (
          <StepRow
            key={step.key}
            step={step}
            ordinal={index + 1}
            kind={classifyStep({ step })}
            provider={resolvedProvider(step)}
            model={resolvedModel(step)}
            effort={effort}
            estimate={hasStepEstimates ? (estimates?.steps.get(step.key) ?? null) : undefined}
            span={span}
            identityIndex={identityIndex}
            isExpanded={expandedKey === step.key}
            isEdited={editedKeys.has(step.key)}
            isPinned={step.provider !== '' || step.model !== ''}
            isDragging={draggingKey === step.key}
            disabled={blocked}
            onToggle={() => setExpandedKey((cur) => (cur === step.key ? null : step.key))}
            onStartDrag={(event) =>
              startStepDrag(index, step.name.trim() || ROLE_LABEL[step.role], event)
            }
            onMoveUp={() => moveStep(step.key, -1)}
            onMoveDown={() => moveStep(step.key, 1)}
            editor={
              <StepEditor
                step={step}
                ordinal={index + 1}
                stepCount={steps.length}
                effort={effort}
                estimateNote={estimates?.steps.get(step.key)?.note ?? null}
                recommendedProvider={providerId}
                recommendedModel={recommendedModel(step)}
                connectedProviders={connectedProviders}
                isRoutingOverridden={step.provider !== '' || step.model !== ''}
                disabled={blocked}
                polish={stepPolishFields({
                  polish: stepPolish,
                  deps: stepPolishDeps,
                  goal: goalText,
                  step,
                  patchStep,
                })}
                onName={(name) => patchStep(step.key, { name })}
                onRole={(role) => patchStep(step.key, { role })}
                onPrompt={(prompt) => patchStep(step.key, { prompt })}
                onExpectedOutput={(expectedOutput) => patchStep(step.key, { expectedOutput })}
                onRoute={(route) => patchStep(step.key, route)}
                onVerbosity={(verbosity) => patchStep(step.key, { verbosity })}
                onRoutingReset={() => patchStep(step.key, { provider: '', model: '' })}
                onPin={() =>
                  patchStep(step.key, {
                    provider: resolvedProvider(step),
                    model: resolvedModel(step),
                  })
                }
                onMoveUp={() => moveStep(step.key, -1)}
                onMoveDown={() => moveStep(step.key, 1)}
                onDuplicate={() =>
                  setSteps((previous) => duplicateDraftStep({ steps: previous, key: step.key }))
                }
                isSavingAsStep={savingKey === step.key}
                onSaveAsStep={() => void saveAsStep(step)}
                onDelete={() => deleteStep(step.key)}
                onDone={() => setExpandedKey(null)}
              />
            }
          />
        );
      }}
    />
  );

  const guidanceDiffers = guidance !== workflowRules.standingGuidance;
  const spendDiffers =
    isSpendLimitEnabled !== (workflowRules.spendLimitUsd !== null) ||
    (isSpendLimitEnabled &&
      (parseSpendLimit(spendLimitDraft) !== workflowRules.spendLimitUsd ||
        spendLimitMode !== workflowRules.spendLimitMode));
  const guidanceRuleLines = workflowRules.standingGuidance
    .split('\n')
    .filter((line) => line.trim() !== '').length;
  const guidanceRuleSummary =
    guidanceRuleLines === 0
      ? 'empty'
      : `${guidanceRuleLines} ${guidanceRuleLines === 1 ? 'rule' : 'rules'}`;

  const onPolishGuidance = async () => {
    try {
      const polished = await polishGuidance(guidance);
      if (polished === null || polished === guidance) {
        return;
      }
      setGuidanceUndo(guidance);
      setGuidance(polished);
    } catch (err) {
      setError({ title: "Couldn't polish the guidance", message: formatError(err) });
    }
  };

  const guidanceTools = (
    <GuidanceTools
      differs={guidanceDiffers}
      isRuleEmpty={workflowRules.standingGuidance.trim() === ''}
      canUndo={guidanceUndo !== null}
      canPolish={guidance.trim() !== ''}
      isPolishing={isPolishingGuidance}
      disabled={blocked}
      onReset={() => {
        setGuidance(workflowRules.standingGuidance);
        setGuidanceUndo(null);
      }}
      onSaveDefault={() => {
        void patchWorkflowRules({ standingGuidance: guidance.trim(), guidanceRoles }).catch(
          (err: unknown) =>
            setError({ title: "Couldn't save the guidance", message: formatError(err) }),
        );
      }}
      onUndo={() => {
        if (guidanceUndo !== null) {
          setGuidance(guidanceUndo);
          setGuidanceUndo(null);
        }
      }}
      onPolish={() => void onPolishGuidance()}
    />
  );

  const renderPlan = () => {
    if (mode === 'dynamic') {
      return (
        <OrchestratorRow
          identityIndex={identityIndex}
          guidance={guidance}
          guidanceFooter={
            <>
              {guidanceTools}
              <span className="text-meta text-muted-foreground">
                Sent to <span className="text-foreground">the orchestrator</span>
              </span>
            </>
          }
          providerOverride={orchestratorProviderOverride}
          modelOverride={orchestratorModelOverride}
          effort={orchestratorEffort}
          recommendedProvider={resolvedOrchestratorTaskModel.providerId}
          recommendedModel={recommendedOrchestratorModel}
          allowedProviders={orchestratorProviders}
          isOverridden={isOrchestratorOverridden}
          disabled={blocked}
          onGuidance={setGuidance}
          onRoute={(route) => {
            setOrchestratorProviderOverride(route.provider);
            setOrchestratorModelOverride(route.model);
            if (route.provider !== '' && route.effort !== requestedOrchestratorEffort) {
              setOrchestratorEffortOverride(route.effort);
            }
          }}
          onReset={resetOrchestratorModel}
        />
      );
    }
    if (mode === 'preset' && presets.length === 0) {
      return (
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.workflows}
          icon={CONCEPT_ICONS.workflows}
          title="No presets in this workspace yet"
          description="Save a workflow as a preset when you start it, and it shows up here."
          action={
            <Chip
              as="button"
              tone="primary"
              kind="reference"
              shape="badge"
              label="Describe your own"
              onClick={() => setMode('custom')}
            />
          }
        />
      );
    }
    if (mode === 'preset' && steps.length === 0) {
      return null;
    }
    return renderPlanTree();
  };

  const launchControls = (
    <>
      <StartsChip
        choice={startChoice}
        runs={activeRuns}
        disabled={blocked}
        onChange={setStartChoice}
      />
      <AutonomyChip
        autonomy={autonomy}
        ruleAutonomy={workflowRules.autonomy}
        disabled={busy}
        onChange={chooseAutonomy}
      />
      <SpendCapChip
        isEnabled={isSpendLimitEnabled}
        amount={spendLimitDraft}
        mode={spendLimitMode}
        isInvalid={spendLimitInvalid}
        rule={{
          isEnabled: workflowRules.spendLimitUsd !== null,
          amount: workflowRules.spendLimitUsd?.toString() ?? '',
          mode: workflowRules.spendLimitMode,
        }}
        disabled={blocked}
        onEnabled={setIsSpendLimitEnabled}
        onAmount={setSpendLimitDraft}
        onMode={setSpendLimitMode}
        onReset={() => {
          setIsSpendLimitEnabled(workflowRules.spendLimitUsd !== null);
          setSpendLimitDraft(workflowRules.spendLimitUsd?.toString() ?? '');
          setSpendLimitMode(workflowRules.spendLimitMode);
        }}
      />
      {mode !== 'dynamic' && canSaveAsPreset ? (
        <Switch
          label="Save as preset"
          checked={saveAsPreset}
          onChange={setSaveAsPreset}
          disabled={busy}
        />
      ) : null}
    </>
  );

  const fields = (
    <>
      <div className="flex flex-col gap-3">
        <BuilderTitleField
          value={title}
          placeholder={defaultTitle}
          suggestion={activeSuggestion}
          disabled={blocked}
          onChange={setTitle}
          onAcceptSuggestion={() => {
            if (activeSuggestion !== null) {
              setTitle(activeSuggestion);
            }
          }}
          origin={
            isPresetEdited && basePreset !== null ? (
              <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-chip text-muted-foreground">
                {`Edited from ${basePreset.name}`}
              </span>
            ) : null
          }
          estimate={estimates?.total == null ? null : <PlanEstimateChip total={estimates.total} />}
        />
        <GoalField
          value={goalText}
          {...(kickoff !== null && { placeholder: kickoff.goalPlaceholder })}
          hasSessionGoal={sessionGoal.length > 0}
          isSessionGoal={goalText === sessionGoal}
          canUndo={goalHistory.length > 0}
          isPolishing={polishing}
          disabled={busy}
          files={goalFiles.files}
          notice={goalFiles.notice}
          onChange={onGoalChange}
          onBlur={() => requestTitleSuggestion(goalText)}
          onUseSessionGoal={onUseSessionGoal}
          onUndo={onUndoGoal}
          onPolish={() => void onPolishGoal()}
        />
      </div>
      <div className="flex flex-col gap-4">
        <ModeSwitch mode={mode} disabled={blocked} control={modeControl} onChange={setMode} />
        {mode === 'custom' && isPlannerOpen ? (
          <PlannerDraftRow
            process={processText}
            hasPlan={plan !== null}
            isPlanning={planning}
            disabled={blocked}
            connectedProviders={connectedProviders}
            providerOverride={plannerProviderOverride}
            modelOverride={plannerModelOverride}
            effort={plannerEffort}
            recommendedProvider={resolvedPlanTaskModel.providerId}
            recommendedModel={plannerRecommendedModel}
            onProcess={setProcessText}
            onRoute={(route) => {
              setPlannerProviderOverride(route.provider);
              setPlannerModelOverride(route.model);
              if (route.provider !== '' && route.effort !== plannerEffort) {
                setPlannerEffortOverride(route.effort);
              }
            }}
            onPlan={() => void onPlan()}
          />
        ) : null}
        {renderPlan()}
        {mode === 'dynamic' ? null : (
          <RunGuidanceField
            guidance={guidance}
            ruleSummary={guidanceRuleSummary}
            differs={guidanceDiffers}
            disabled={blocked}
            tools={guidanceTools}
            recipients={
              guidance.trim() === '' ? (
                <EmptyLine className="text-meta text-faint-foreground">Nothing to send.</EmptyLine>
              ) : (
                <>
                  <GuidanceRecipients
                    roles={guidanceRoles}
                    disabled={blocked}
                    marker={
                      sameRoles({
                        left: guidanceRoles,
                        right: workflowRules.guidanceRoles,
                      }) ? null : (
                        <RuleDot
                          ruleValue={guidanceRoleNames({ roles: workflowRules.guidanceRoles })}
                        />
                      )
                    }
                    onRoles={setGuidanceRoles}
                  />
                </>
              )
            }
            onGuidance={setGuidance}
          />
        )}
      </div>
      <div className="flex flex-col gap-3">
        {error === null ? null : (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title={error.title}
            body={error.message}
          />
        )}
        <FromRulesRow
          changed={[
            ...(autonomyOverride === null ? [] : ['when to ask']),
            ...(spendDiffers ? ['spend cap'] : []),
            ...(guidanceDiffers ? ['guidance'] : []),
          ]}
        />
        <LaunchBar
          controls={launchControls}
          reason={startGate.reason}
          isStartDisabled={startGate.isDisabled}
          isStarting={busy}
          label={kickoff?.primaryLabel ?? null}
          canDiscard={!draftEmpty}
          onDiscard={resetDraft}
          onStart={() => void onStart()}
        />
      </div>
      <DragGhost ghost={ghost} />
    </>
  );

  if (kickoff !== null) {
    return <div className="flex flex-col gap-8">{fields}</div>;
  }

  return (
    <StudioShell
      icon={CONCEPT_ICONS.workflows}
      title="Start a run"
      closeLabel="cancel workflow builder"
      onClose={handleClose}
      variant="slot"
    >
      {() => <FormPage>{fields}</FormPage>}
    </StudioShell>
  );
};
