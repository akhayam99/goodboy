import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Notice,
  PANE_RHYTHM,
  ScrollFade,
  Switch,
  Tooltip,
  cn,
  formatError,
} from '@goodboy/ui';
import {
  PROVIDER_CAPABILITIES,
  type PlannerOutput,
  clampEffortForModel,
  recommendedModelForRole,
  resolveRoleRouting,
  resolveTaskModel,
  runsForWorkflowRun,
} from '@goodboy/core';
import type {
  EffortLevel,
  ProviderId,
  RoleModelPreferences,
  Session,
  Workflow,
  WorkflowExecutionMode,
  WorkflowId,
  WorkflowSpendLimitMode,
} from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import {
  createWorkflowPlanner,
  polishWorkflowGoalText,
  polishWorkflowStep,
} from '../../../workflows/workflows';
import { EMPTY_ARRAY, useAppStore, useSessionSlots } from '../../../../store';
import { buildProfileGuard } from '../../../../store/profileGuard';
import { workflowStartGate } from './workflowStartGate';
import { readLastWorkflowMode, writeLastWorkflowMode } from './lastWorkflowMode';
import { editedStepKeys, stepsMatchPreset } from './presetEdits';
import type { Mode, WorkflowBuilderDraft } from '../../../../store/slices/workflowDrafts/types';
import type { StepDraft, WorkflowDraft } from '../../../workflows/engine';
import {
  addStep as addDraftStep,
  draftFromPlannerSteps,
  draftFromWorkflow,
  duplicateStep as duplicateDraftStep,
  removeStep as removeDraftStep,
  reorderSteps as reorderDraftSteps,
  stepDraftWithModel,
  updateStep as updateDraftStep,
  upsertArgsFromDraft,
} from '../../../workflows/engine';
import { useWorkflowDraft } from '../../../workflows/engine/useWorkflowDraft';
import { ROLE_LABEL, classifyStep } from '../../agent-kind';
import { isWorkflowRunComplete } from '../../../workflows/isWorkflowRunComplete';
import { useWorkflowDrag } from '../../../workflows/hooks/useWorkflowDrag';
import { parseSpendLimit } from '../../../workflows/components/RunSpendLimitPopover/SpendLimitFields';
import { DragGhost } from '../../../workflows/components/WorkflowStudio/DragGhost';
import { useToast } from '../../../../app/components/Toast';
import { StudioShell } from '../../../../shared/components/StudioShell';
import {
  AttachmentChip,
  pendingAttachmentProps,
} from '../../../attachments/components/AttachmentChip';
import { toAttachmentInput } from '../../../chat/components/ChatInput/lib';
import { usePendingAttachments } from '../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { runIdentity, runIdentitySeed } from '../../timeline/runIdentity';
import { BuilderTitleField } from './parts/BuilderTitleField';
import { GoalField } from './parts/GoalField';
import { LaunchBar } from './parts/LaunchBar';
import { ModeSwitch } from './parts/ModeSwitch';
import { ProviderPoolChip } from './parts/ProviderPoolChip';
import { effectiveProviderPool } from './providerPool';
import { PlanDraftingBanner } from './parts/PlanDraftingBanner';
import { PresetPicker } from './parts/PresetPicker';
import { SpendCapChip } from './parts/SpendCapChip';
import { StartsChip, type ChainRun, type StartChoice } from './parts/StartsChip';
import { StepTree } from '../../../workflows/components/StepTree';
import { StepEditor } from '../../../workflows/components/StepTree/StepEditor';
import { StepRow } from '../../../workflows/components/StepTree/StepRow';
import { OrchestratorRow } from './parts/OrchestratorRow';
import { PlannerDraftRow } from './parts/PlannerDraftRow';
import { PlanEstimateChip } from './parts/PlanEstimateChip';
import { usePlanEstimates } from './usePlanEstimates';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
};

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
    effort: resolveRoleRouting({ role: step.role, prefs: roleModels }).effort as EffortLevel,
  }));

const isDraftEmpty = (d: WorkflowBuilderDraft): boolean =>
  d.goalText.trim() === '' &&
  d.goalHistory.length === 0 &&
  d.selectedPresetId === null &&
  d.basePresetId === null &&
  d.processText.trim() === '' &&
  d.plan === null &&
  d.workflow.steps.length === 0 &&
  !d.saveAsPreset &&
  !d.autoRun &&
  d.title.trim() === '' &&
  d.orchestratorModel.providerOverride === '' &&
  d.orchestratorModel.modelOverride === '' &&
  d.orchestratorModel.effortOverride === null &&
  d.providerPool === null;

const PLANNER_EFFORT: EffortLevel = resolveRoleRouting({ role: 'planner', prefs: null }).effort;
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

export const WorkflowBuilderView = ({ session, onClose }: Props) => {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const generateWorkflowTitle = useAppStore((s) => s.generateWorkflowTitle);
  const suggestWorkflowTitle = useAppStore((s) => s.suggestWorkflowTitle);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionPhaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns?.[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<never>),
  );
  const providers = useAppStore(
    (s) => s.providers ?? (EMPTY_ARRAY as ReadonlyArray<never>),
  ) as ReadonlyArray<ProviderEntry>;
  const workspaceOverrides = useAppStore(
    (s) => s.workspaceOverrides?.[session.workspaceId] ?? null,
  );
  const roleModels = workspaceOverrides?.roleModels ?? null;
  const roleEffort = (role: StepDraft['role']): EffortLevel =>
    resolveRoleRouting({ role, prefs: roleModels }).effort as EffortLevel;
  const setWorkflowDraft = useAppStore((s) => s.setWorkflowDraft);
  const clearWorkflowDraft = useAppStore((s) => s.clearWorkflowDraft);
  const sessionSlots = useSessionSlots(session.id);
  const sessionWorktree = useSessionRepo({ sessionId: session.id })?.worktreePath ?? null;
  const { showToast } = useToast();

  const {
    attachments,
    isDragging: isDraggingFiles,
    composerRef,
    fileInputRef,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({ showToast });

  const presets = phaseTemplates.filter((t) => t.isPreset !== false && !t.deletedAt);

  const [initialDraft] = useState(() => useAppStore.getState().workflowDrafts[session.id]);

  const defaultMode = (): Mode => {
    const last = readLastWorkflowMode({ workspaceId: session.workspaceId });
    return last === 'preset' && presets.length === 0 ? 'dynamic' : last;
  };

  const [mode, setMode] = useState<Mode>(() => initialDraft?.mode ?? defaultMode());
  const [goalText, setGoalText] = useState(initialDraft?.goalText ?? '');
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
  const [polishingKey, setPolishingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saveAsPreset, setSaveAsPreset] = useState(initialDraft?.saveAsPreset ?? false);
  const [autoRun, setAutoRun] = useState(initialDraft?.autoRun ?? false);
  const [startChoice, setStartChoice] = useState<StartChoice>(IMMEDIATE_START);
  const [isSpendLimitEnabled, setIsSpendLimitEnabled] = useState(false);
  const [spendLimitDraft, setSpendLimitDraft] = useState('');
  const [spendLimitMode, setSpendLimitMode] = useState<WorkflowSpendLimitMode>('pause');
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

  const providerId =
    providers.find((p) => p.id === session.providerOverride)?.id ??
    session.providerPreference.defaultProvider;

  const connectedProviders = useMemo<ReadonlyArray<ProviderId>>(
    () => providers.filter((p) => p.connection === 'connected').map((p) => p.id),
    [providers],
  );

  const resolvedPlanTaskModel = useMemo(
    () =>
      resolveTaskModel({
        task: 'plan_generation',
        preferences: workspaceOverrides?.taskModels,
        workspaceDefaultProviderId: workspaceOverrides?.defaultProviderId,
        sessionDefaultProviderId: providerId,
      }),
    [workspaceOverrides, providerId],
  );

  const resolvedProsePolishTaskModel = useMemo(
    () =>
      resolveTaskModel({
        task: 'prose_polish',
        preferences: workspaceOverrides?.taskModels,
        workspaceDefaultProviderId: workspaceOverrides?.defaultProviderId,
        sessionDefaultProviderId: providerId,
      }),
    [workspaceOverrides, providerId],
  );

  const plannerEffectiveProviderId: ProviderId =
    plannerProviderOverride !== '' ? plannerProviderOverride : resolvedPlanTaskModel.providerId;

  const plannerRecommendedModel = useMemo(
    () =>
      plannerProviderOverride !== ''
        ? resolveTaskModel({
            task: 'plan_generation',
            preferences: null,
            workspaceDefaultProviderId: plannerProviderOverride,
            sessionDefaultProviderId: providerId,
          }).model
        : resolvedPlanTaskModel.model,
    [plannerProviderOverride, providerId, resolvedPlanTaskModel],
  );

  const plannerEffort = plannerEffortOverride ?? resolvedPlanTaskModel.effort ?? PLANNER_EFFORT;

  const resolvedOrchestratorTaskModel = useMemo(
    () =>
      resolveTaskModel({
        task: 'workflow_orchestrator',
        preferences: workspaceOverrides?.taskModels,
        workspaceDefaultProviderId: workspaceOverrides?.defaultProviderId,
        sessionDefaultProviderId: providerId,
      }),
    [workspaceOverrides, providerId],
  );

  const orchestratorProviders = useMemo<ReadonlyArray<ProviderId>>(
    () =>
      connectedProviders.filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0),
    [connectedProviders],
  );
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
        ? resolveTaskModel({
            task: 'workflow_orchestrator',
            preferences: null,
            workspaceDefaultProviderId: orchestratorProviderOverride,
            sessionDefaultProviderId: providerId,
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
    const runs = session.workflowRuns ?? [];
    return runs
      .filter((r) => !r.discardedAt)
      .flatMap((r) => {
        const template = phaseTemplates.find((t) => t.id === r.workflowId) ?? null;
        if (template === null) {
          return [];
        }
        const agents = runsForWorkflowRun(sessionPhaseRuns, r.id);
        const complete = isWorkflowRunComplete({ run: r, workflow: template, agents });
        const failed = agents.some((a) => a.status === 'failed');
        return complete || failed ? [] : [{ run: r, template, ordinal: r.ordinal }];
      })
      .sort((a, b) => a.ordinal - b.ordinal);
  }, [session.workflowRuns, phaseTemplates, sessionPhaseRuns]);

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
    laneIndex: (session.workflowRuns ?? []).filter((r) => r.createdAt != null).length,
    seed: runIdentitySeed({ sessionId: session.id }),
  }).index;

  const draft: WorkflowBuilderDraft = {
    mode,
    goalText,
    goalHistory,
    selectedPresetId,
    basePresetId,
    processText,
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
    title,
    orchestratorModel: {
      providerOverride: orchestratorProviderOverride,
      modelOverride: orchestratorModelOverride,
      effortOverride: orchestratorEffortOverride,
    },
    providerPool,
  };
  const draftEmpty = isDraftEmpty(draft);

  useEffect(() => {
    if (draftEmpty) {
      clearWorkflowDraft(session.id);
    } else {
      setWorkflowDraft(session.id, draft);
    }
  }, [
    session.id,
    mode,
    goalText,
    goalHistory,
    selectedPresetId,
    basePresetId,
    processText,
    plan,
    steps,
    saveAsPreset,
    autoRun,
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
    setPlan(null);
    setSteps([]);
    setIsPlannerOpen(true);
    setSaveAsPreset(false);
    setAutoRun(false);
    setTitle('');
    setTitleSuggestion(null);
    suggestedGoalRef.current = null;
    resetOrchestratorModel();
    setProviderPool(null);
    setStartChoice(IMMEDIATE_START);
    setIsSpendLimitEnabled(false);
    setSpendLimitDraft('');
    setSpendLimitMode('pause');
    setError(null);
    setExpandedKey(null);
    clearWorkflowDraft(session.id);
  };

  const handleClose = () => {
    clearWorkflowDraft(session.id);
    onClose();
  };

  const blocked = busy || planning;

  const requestTitleSuggestion = (goal: string) => {
    const trimmed = goal.trim();
    if (trimmed === '' || trimmed === suggestedGoalRef.current) {
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

  const removeStep = (key: string) => {
    setSteps((previous) => removeDraftStep({ steps: previous, key }));
    setExpandedKey((cur) => (cur === key ? null : cur));
  };

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

  const addStep = () => {
    setSteps((previous) => addDraftStep({ steps: previous }));
  };

  const { drag, dropIndex, startStepDrag, ghost } = useWorkflowDrag({
    enabled: steps.length > 0,
    onDropLibrary: () => {},
    onReorder: moveStepTo,
  });
  const isDraggingStep = drag !== null;
  const draggingKey = drag?.kind === 'step' ? (steps[drag.fromIndex]?.key ?? null) : null;

  const resolvedProvider = (step: StepDraft): ProviderId =>
    step.provider !== '' ? step.provider : providerId;
  const recommendedModel = (step: StepDraft): string =>
    recommendedModelForRole({
      role: step.role ?? 'custom',
      provider: resolvedProvider(step),
      prefs: roleModels,
    });
  const resolvedModel = (step: StepDraft): string =>
    step.model !== '' ? step.model : recommendedModel(step);

  const onPolishStep = async (key: string) => {
    const step = steps.find((s) => s.key === key);
    if (step === undefined || step.prompt.trim().length === 0 || polishingKey !== null) {
      return;
    }
    setError(null);
    setPolishingKey(key);
    try {
      const polished = await polishWorkflowStep({
        deps: {
          ...resolvedProsePolishTaskModel,
          ...(sessionWorktree != null && { workingDir: sessionWorktree }),
        },
        input: {
          role: step.role,
          name: step.name,
          instruction: step.prompt,
          ...(goalText.trim().length > 0 && { goal: goalText }),
        },
      });
      if (polished !== null && polished !== step.prompt) {
        patchStep(key, { prompt: polished });
        return;
      }
      if (!polished) {
        showToast({
          kind: 'warning',
          message: 'Kept your wording. The step could not be polished.',
        });
        return;
      }
    } catch (err) {
      setError({ title: "Couldn't polish the step", message: formatError(err) });
    } finally {
      setPolishingKey(null);
    }
  };

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
          message: 'Kept your wording. The goal could not be polished.',
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
      await deleteWorkflow(t.id, session.workspaceId);
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

  const attachOptions = () => {
    const goal = goalText.trim();
    const { triggerMode, chainAfterId } = startChoice;
    const spendLimitUsd =
      mode === 'dynamic' && isSpendLimitEnabled ? parseSpendLimit(spendLimitDraft) : null;
    return {
      autoRun,
      navigate: true,
      ...(goal.length > 0 && { goal }),
      ...(triggerMode !== 'immediate' && { triggerMode }),
      ...(triggerMode === 'after_run' && chainAfterId !== null && { chainAfterId }),
      ...(attachments.length > 0 && { attachmentInputs: attachments.map(toAttachmentInput) }),
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
      const profileBlock = buildProfileGuard({
        profile: useAppStore
          .getState()
          .workspaces.find((candidate) => candidate.id === session.workspaceId)?.profile,
      });
      const result = await client.plan({
        process,
        ...(profileBlock.length > 0 && { repoContext: profileBlock }),
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

  const onStart = async () => {
    if (blocked) {
      return;
    }
    const usePresetAsIs =
      mode === 'preset' && selectedPreset !== null && !presetDirty && !isPresetRenamed;
    if (
      (mode === 'preset' && selectedPreset === null) ||
      (mode === 'custom' && steps.length === 0)
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (usePresetAsIs) {
        await attachWorkflowToSession(session.id, selectedPreset.id, attachOptions());
        writeLastWorkflowMode({ workspaceId: session.workspaceId, mode });
        showToast({ kind: 'success', message: `Started ${selectedPreset.name}.` });
        handleClose();
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
      const process = mode === 'custom' || mode === 'dynamic' ? processText.trim() : '';
      const workflow: Workflow = {
        id: workflowId,
        workspaceId: session.workspaceId,
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
                workspaceId: session.workspaceId,
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
          session.workspaceId,
          workflowId,
          session.id,
          saved?.name ?? name,
          goal,
          process,
        );
      }
      await attachWorkflowToSession(session.id, workflowId, attachOptions());
      writeLastWorkflowMode({ workspaceId: session.workspaceId, mode });
      showToast({ kind: 'success', message: `Started ${saved?.name ?? name}.` });
      handleClose();
    } catch (err) {
      setError({ title: "Couldn't start the workflow", message: formatError(err) });
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
        emphasis="outline"
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
    workspaceId: session.workspaceId,
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
            isDragging={draggingKey === step.key}
            disabled={blocked}
            onToggle={() => setExpandedKey((cur) => (cur === step.key ? null : step.key))}
            onStartDrag={(event) =>
              startStepDrag(index, step.name.trim() || ROLE_LABEL[step.role], event)
            }
            onMoveUp={() => moveStep(step.key, 1)}
            onMoveDown={() => moveStep(step.key, -1)}
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
                polish={{
                  isPolishing: polishingKey === step.key,
                  onPolish: () => void onPolishStep(step.key),
                }}
                onName={(name) => patchStep(step.key, { name })}
                onRole={(role) => patchStep(step.key, { role })}
                onPrompt={(prompt) => patchStep(step.key, { prompt })}
                onExpectedOutput={(expectedOutput) => patchStep(step.key, { expectedOutput })}
                onProvider={(provider) => patchStep(step.key, { provider })}
                onModel={(model) =>
                  patchStep(
                    step.key,
                    stepDraftWithModel({
                      step,
                      provider: step.provider,
                      model,
                      recommendedModel: recommendedModel(step),
                    }),
                  )
                }
                onEffort={(next) => patchStep(step.key, { effort: next })}
                onVerbosity={(verbosity) => patchStep(step.key, { verbosity })}
                onRoutingReset={() => patchStep(step.key, { provider: '', model: '' })}
                onMoveUp={() => moveStep(step.key, 1)}
                onMoveDown={() => moveStep(step.key, -1)}
                onDuplicate={() =>
                  setSteps((previous) => duplicateDraftStep({ steps: previous, key: step.key }))
                }
                onRemove={() => removeStep(step.key)}
                onDone={() => setExpandedKey(null)}
              />
            }
          />
        );
      }}
    />
  );

  const renderPlan = () => {
    if (mode === 'dynamic') {
      return (
        <OrchestratorRow
          identityIndex={identityIndex}
          guidance={processText}
          providerOverride={orchestratorProviderOverride}
          modelOverride={orchestratorModelOverride}
          effort={orchestratorEffort}
          recommendedProvider={resolvedOrchestratorTaskModel.providerId}
          recommendedModel={recommendedOrchestratorModel}
          allowedProviders={orchestratorProviders}
          isOverridden={isOrchestratorOverridden}
          disabled={blocked}
          onGuidance={setProcessText}
          onProvider={(next) => {
            setOrchestratorProviderOverride(next);
            setOrchestratorModelOverride('');
          }}
          onModel={setOrchestratorModelOverride}
          onEffort={setOrchestratorEffortOverride}
          onReset={resetOrchestratorModel}
        />
      );
    }
    if (mode === 'preset' && presets.length === 0) {
      return (
        <EmptyState
          tone={CONCEPT_TONE.workflows}
          icon={CONCEPT_ICONS.workflows}
          title="No presets in this workspace yet"
          description="Save a workflow as a preset when you start it, and it shows up here."
          size="inline"
          className="items-start text-left"
          action={
            <Chip
              as="button"
              tone="primary"
              size="control"
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
      <Tooltip
        content={
          autoRun
            ? 'Each next step starts on its own.'
            : 'Pauses after each step so you can review it.'
        }
      >
        <Switch label="Autorun" checked={autoRun} onChange={setAutoRun} disabled={busy} />
      </Tooltip>
      {mode === 'dynamic' ? (
        <SpendCapChip
          isEnabled={isSpendLimitEnabled}
          amount={spendLimitDraft}
          mode={spendLimitMode}
          isInvalid={spendLimitInvalid}
          disabled={blocked}
          onEnabled={setIsSpendLimitEnabled}
          onAmount={setSpendLimitDraft}
          onMode={setSpendLimitMode}
        />
      ) : null}
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

  return (
    <StudioShell
      icon={CONCEPT_ICONS.workflows}
      title="Start a workflow"
      closeLabel="cancel workflow builder"
      onClose={handleClose}
      variant="slot"
    >
      {() => (
        <ScrollFade className="min-h-0 w-full flex-1">
          <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.body, 'flex flex-col gap-8')}>
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
                    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                      {`Edited from ${basePreset.name}`}
                    </span>
                  ) : null
                }
                estimate={
                  estimates?.total == null ? null : <PlanEstimateChip total={estimates.total} />
                }
              />
              <GoalField
                value={goalText}
                hasSessionGoal={sessionGoal.length > 0}
                isSessionGoal={goalText === sessionGoal}
                canUndo={goalHistory.length > 0}
                isPolishing={polishing}
                disabled={busy}
                files={{
                  isDragging: isDraggingFiles,
                  composerRef,
                  fileInputRef,
                  onFiles: onFileInputChange,
                  attachments: attachments.map((a) => (
                    <AttachmentChip
                      key={a.id}
                      {...pendingAttachmentProps(a)}
                      onRemove={() => removeAttachment(a.id)}
                    />
                  )),
                }}
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
                  onProvider={(next) => {
                    setPlannerProviderOverride(next);
                    setPlannerModelOverride('');
                  }}
                  onModel={setPlannerModelOverride}
                  onEffort={setPlannerEffortOverride}
                  onPlan={() => void onPlan()}
                />
              ) : null}
              {renderPlan()}
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
              <LaunchBar
                controls={launchControls}
                reason={startGate.reason}
                isStartDisabled={startGate.isDisabled}
                isStarting={busy}
                canDiscard={!draftEmpty}
                onDiscard={resetDraft}
                onStart={() => void onStart()}
              />
            </div>
            <DragGhost ghost={ghost} />
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
