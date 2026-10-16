import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, EmptyState, formatError } from '@goodboy/ui';
import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  PROVIDER_CAPABILITIES,
  clampEffortForModel,
  isAgentStatusHalted,
  runsForWorkflowRun,
} from '@goodboy/core';
import { ORCHESTRATED_WORKFLOW_NAME, uniqueWorkflowName } from '../../uniqueWorkflowName';
import { useResolution } from '../../../providers/hooks/useResolution';
import { autoModelOn } from '../../../providers/autoModelOn';
import { modelOnProvider, roleResolutionOf } from '../../../providers/roleResolution';
import { resolutionAsTask } from '../../../providers/resolutionAsTask';
import type {
  EffortLevel,
  ProviderId,
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
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { Docked } from '../../../../shared/components/Docked';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { deleteWorkflowWithUndo } from '../../deleteWorkflowWithUndo';
import { polishWorkflowGoalText } from '../../workflows';
import { usePolishGuidance } from '../../hooks/usePolishGuidance';
import { EMPTY_ARRAY, useAppStore, useSessionSlots } from '../../../../store';
import { workflowStartGate } from './workflowStartGate';
import { editedStepKeys, stepsMatchPreset } from './presetEdits';
import type {
  KickoffLane,
  Mode,
  WorkflowBuilderDraft,
  WorkflowDraftKey,
} from '../../../../store/slices/workflowDrafts/types';
import { kickoffDraftKey } from '../../../../store/slices/workflowDrafts/kickoffDraftKey';
import type { StepDraft } from '../../engine';
import {
  draftFromWorkflow,
  updateStep as updateDraftStep,
  upsertArgsFromDraft,
} from '../../engine';
import { classifyStep } from '../../../session/agent-kind';
import { isWorkflowRunComplete } from '../../isWorkflowRunComplete';
import { isPresetWorkflow } from '../../isPresetWorkflow';
import { parseSpendLimit } from '../../../budget/parseSpendLimit';
import { useToast } from '../../../../shared/components/Toast';
import { toAttachmentInputs } from '../../../attachments/pendingAttachment';
import { usePromptFiles } from '../../../../shared/hooks/usePromptFiles';
import { runIdentity, runIdentitySeed } from '../../../session/timeline/runIdentity';
import { GoalField } from './parts/GoalField';
import { LaunchBar } from './parts/LaunchBar';
import { ProviderPoolChip } from './parts/ProviderPoolChip';
import { effectiveProviderPool } from './providerPool';
import { PresetPicker } from './parts/PresetPicker';
import { SpendCapChip } from './parts/SpendCapChip';
import { AutonomyChip } from './parts/AutonomyChip';
import { GuidanceTools } from './parts/GuidanceTools';
import { RuleDot } from './parts/RuleDot';
import { RunGuidance } from './parts/RunGuidance';
import { GuidanceRecipients } from '../WorkflowGuidance/GuidanceRecipients';
import { guidanceRoleNames, sameRoles } from '../../guidanceRoles';
import { useWorkflowRules } from '../../hooks/useWorkflowRules';
import { StartsChip, type ChainRun, type StartChoice } from './parts/StartsChip';
import { OrchestrateLane } from './parts/OrchestrateLane';
import { PresetLane, type PresetLaneRow } from './parts/PresetLane';
import { PlanEstimateChip } from './parts/PlanEstimateChip';
import { usePlanEstimates } from './usePlanEstimates';
import { offeredSessionGoal } from './offeredSessionGoal';

export type BuilderKickoff = {
  readonly workspaceId: WorkspaceId;
  readonly lane?: KickoffLane;
  readonly goal: string;
  readonly goalPlaceholder: string;
  readonly primaryLabel?: string;
  readonly leading?: ReactNode;
  readonly startError?: string | null;
  readonly canDiscard?: boolean;
  readonly projects?: ReactNode;
  readonly onDiscard?: () => void;
  readonly onGoalChange: (goal: string) => void;
  readonly start: (run: (session: Session) => Promise<void>) => Promise<void>;
};

type BuilderSlots = {
  readonly actionsHost: HTMLElement | null;
};

type Props = {
  readonly mode: Mode;
  readonly onOrchestrateInstead?: () => void;
} & (
  | {
      readonly session: Session;
      readonly kickoff?: never;
      readonly slots?: BuilderSlots;
      readonly onClose: () => void;
    }
  | {
      readonly kickoff: BuilderKickoff;
      readonly session?: never;
      readonly slots?: never;
      readonly onClose?: never;
    }
);

type ProviderEntry = { readonly id: ProviderId; readonly connection: string };

type BuilderError = {
  readonly title: string;
  readonly message: string;
};

const isDraftEmpty = (d: WorkflowBuilderDraft, rules: WorkflowRules): boolean =>
  d.goalText.trim() === '' &&
  d.goalHistory.length === 0 &&
  d.selectedPresetId === null &&
  d.basePresetId === null &&
  d.steps.length === 0 &&
  (d.autonomy ?? rules.autonomy) === rules.autonomy &&
  (d.guidance ?? rules.standingGuidance) === rules.standingGuidance &&
  sameRoles({ left: d.guidanceRoles ?? rules.guidanceRoles, right: rules.guidanceRoles }) &&
  d.title.trim() === '' &&
  d.orchestratorModel.providerOverride === '' &&
  d.orchestratorModel.modelOverride === '' &&
  d.orchestratorModel.effortOverride === null &&
  d.providerPool === null;

const ORCHESTRATOR_EFFORT: EffortLevel = 'medium';
const DYNAMIC_EXECUTION_MODE: WorkflowExecutionMode = 'dynamic';
const PRESET_FALLBACK_NAME = 'Preset run';
const IMMEDIATE_START: StartChoice = { triggerMode: 'immediate', chainAfterId: null };

const PRIMARY_LABEL: Readonly<Record<Mode, string>> = {
  preset: 'Start run',
  dynamic: 'Start orchestration',
};

export const WorkflowBuilderView = (props: Props) => {
  const mode = props.mode;
  const session = props.session ?? null;
  const kickoff = props.kickoff ?? null;
  const slots = props.slots;
  const workspaceId: WorkspaceId =
    props.session !== undefined ? props.session.workspaceId : props.kickoff.workspaceId;
  const draftKey: WorkflowDraftKey =
    props.session !== undefined
      ? props.session.id
      : kickoffDraftKey({ workspaceId, lane: props.kickoff.lane ?? 'workflow' });
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow);
  const restoreWorkflowSnapshot = useAppStore((s) => s.restoreWorkflowSnapshot);
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
  const [titleSuggestion, setTitleSuggestion] = useState<string | null>(null);
  const suggestedGoalRef = useRef<string | null>(null);
  const latestGoalRef = useRef(goalText);
  latestGoalRef.current = goalText;
  const [steps, setSteps] = useState<ReadonlyArray<StepDraft>>(initialDraft?.steps ?? []);
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

  const prosePolishResolution = useResolution({ task: 'prose_polish', ...resolutionScope });
  const resolvedProsePolishTaskModel = useMemo(
    () => resolutionAsTask({ resolution: prosePolishResolution }),
    [prosePolishResolution],
  );

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
    guidance,
    guidanceRoles,
    steps,
    autoRun,
    ...(autonomyOverride !== null && { autonomy: autonomyOverride }),
    title: '',
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
    guidance,
    guidanceRoles,
    steps,
    autoRun,
    autonomyOverride,
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
    setGoalText('');
    setGoalHistory([]);
    setSelectedPresetId(null);
    setBasePresetId(null);
    setGuidance(workflowRules.standingGuidance);
    setGuidanceRoles(workflowRules.guidanceRoles);
    setGuidanceUndo(null);
    setSteps([]);
    setAutonomyOverride(null);
    setTitleSuggestion(null);
    suggestedGoalRef.current = null;
    resetOrchestratorModel();
    setProviderPool(null);
    setStartChoice(IMMEDIATE_START);
    setIsSpendLimitEnabled(workflowRules.spendLimitUsd !== null);
    setSpendLimitDraft(workflowRules.spendLimitUsd?.toString() ?? '');
    setSpendLimitMode(workflowRules.spendLimitMode);
    setError(null);
    clearWorkflowDraft(draftKey);
  };

  const handleClose = () => {
    clearWorkflowDraft(draftKey);
    props.onClose?.();
  };

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

  const sessionGoal = offeredSessionGoal({ slots: sessionSlots, isKickoff: kickoff !== null });
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
  };

  const onResetPreset = () => {
    if (basePreset === null) {
      return;
    }
    setSteps(draftFromWorkflow({ workflow: basePreset }).steps);
  };

  const onDeletePreset = async (t: Workflow) => {
    setError(null);
    try {
      await deleteWorkflowWithUndo({
        workflow: t,
        workspaceId,
        showToast,
        deleteWorkflow,
        restoreWorkflowSnapshot,
      });
      if (selectedPresetId === t.id) {
        setSelectedPresetId(null);
        setBasePresetId(null);
        setSteps([]);
      }
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

  const presetName = selectedPreset?.name ?? basePreset?.name ?? null;
  const fallbackTitle =
    mode === 'dynamic'
      ? uniqueWorkflowName({ requested: ORCHESTRATED_WORKFLOW_NAME, existing: phaseTemplates })
      : (presetName ?? PRESET_FALLBACK_NAME);
  const activeSuggestion = mode === 'preset' ? null : titleSuggestion;
  const defaultTitle = activeSuggestion ?? fallbackTitle;
  const resolvedTitle = defaultTitle;
  const isPresetEdited = basePreset !== null && presetDirty;

  const runOn = async (target: Session): Promise<void> => {
    if (mode === 'preset' && selectedPreset !== null && !presetDirty) {
      await attachWorkflowToSession(target.id, selectedPreset.id, await attachOptions());
      if (kickoff === null) {
        showToast({ kind: 'success', message: `Started ${selectedPreset.name}.` });
      }
      return;
    }
    const now = new Date().toISOString() as Workflow['createdAt'];
    const workflowId = `wf_builder_${crypto.randomUUID()}` as WorkflowId;
    const name = uniqueWorkflowName({ requested: resolvedTitle, existing: phaseTemplates });
    const description =
      mode === 'dynamic'
        ? 'Steps are decided at runtime from the latest results.'
        : (selectedPreset?.description ?? basePreset?.description ?? '');
    const goal = goalText.trim();
    const process = mode === 'dynamic' ? guidance.trim() : '';
    const workflow: Workflow = {
      id: workflowId,
      workspaceId,
      name,
      description,
      ...(goal.length > 0 && { goal }),
      ...(process.length > 0 && { processText: process }),
      steps: [],
      isPreset: false,
      origin: mode === 'dynamic' ? 'orchestrated' : 'custom',
      createdAt: now,
      updatedAt: now,
    };
    const saved = await savePhaseTemplate(
      mode === 'dynamic'
        ? workflow
        : upsertArgsFromDraft({
            workspaceId,
            id: workflowId,
            draft: {
              name,
              description,
              goal,
              steps: steps.map((step) => ({ ...step, sourceStepId: null })),
              origin: 'custom',
              isPreset: false,
            },
          }),
    );
    if (mode === 'dynamic' && activeSuggestion === null) {
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
    if (kickoff === null) {
      showToast({ kind: 'success', message: `Started ${saved?.name ?? name}.` });
    }
  };

  const onStart = async () => {
    if (busy) {
      return;
    }
    if (mode === 'preset' && selectedPreset === null) {
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
  const stepsMissing = mode === 'preset' && selectedPreset === null;
  const spendLimitInvalid = isSpendLimitEnabled && parseSpendLimit(spendLimitDraft) == null;
  const startGate = workflowStartGate({
    mode,
    isStarting: busy,
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
          isEdited={isPresetEdited}
          disabled={busy}
          onSelect={onSelectPreset}
          onReset={onResetPreset}
          onDelete={onDeletePreset}
        />
      ) : null
    ) : orchestratorProviders.length > 1 ? (
      <ProviderPoolChip
        providers={orchestratorProviders}
        pool={effectivePool}
        disabled={busy}
        onChange={setProviderPool}
      />
    ) : null;

  const presetDescription =
    mode === 'preset' && selectedPreset !== null && selectedPreset.description !== ''
      ? selectedPreset.description
      : null;

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

  const presetRows: ReadonlyArray<PresetLaneRow> = steps.map((step) => ({
    step,
    kind: classifyStep({ step }),
    provider: resolvedProvider(step),
    model: resolvedModel(step),
    effort: step.effort ?? roleEffort(step.role),
    recommendedProvider: providerId,
    recommendedModel: recommendedModel(step),
    isPinned: step.provider !== '' || step.model !== '',
    isEdited: editedKeys.has(step.key),
    estimate: estimates?.steps.get(step.key) ?? null,
  }));

  const guidanceDiffers = guidance !== workflowRules.standingGuidance;
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
      disabled={busy}
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

  const guidanceFooter =
    mode === 'dynamic' ? (
      <span className="text-meta text-muted-foreground">
        Sent to <span className="text-foreground">the orchestrator</span>
      </span>
    ) : guidance.trim() === '' ? null : (
      <GuidanceRecipients
        roles={guidanceRoles}
        disabled={busy}
        marker={
          sameRoles({ left: guidanceRoles, right: workflowRules.guidanceRoles }) ? null : (
            <RuleDot ruleValue={guidanceRoleNames({ roles: workflowRules.guidanceRoles })} />
          )
        }
        onRoles={setGuidanceRoles}
      />
    );

  const renderLane = () => {
    if (mode === 'dynamic') {
      return (
        <OrchestrateLane
          identityIndex={identityIndex}
          providerOverride={orchestratorProviderOverride}
          modelOverride={orchestratorModelOverride}
          effort={orchestratorEffort}
          recommendedProvider={resolvedOrchestratorTaskModel.providerId}
          recommendedModel={recommendedOrchestratorModel}
          allowedProviders={orchestratorProviders}
          isOverridden={isOrchestratorOverridden}
          isDisabled={busy}
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
    if (presets.length === 0) {
      return (
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.workflows}
          icon={CONCEPT_ICONS.workflows}
          title="No presets in this workspace yet"
          description="Save a run as a preset from its page, and it shows up here."
          action={
            props.onOrchestrateInstead === undefined ? undefined : (
              <Button size="sm" variant="secondary" onClick={props.onOrchestrateInstead}>
                Orchestrate instead
              </Button>
            )
          }
        />
      );
    }
    if (steps.length === 0) {
      return null;
    }
    return (
      <PresetLane
        rows={presetRows}
        identityIndex={identityIndex}
        autonomy={autonomy}
        connectedProviders={connectedProviders}
        isDisabled={busy}
        onRoute={(key, route) => patchStep(key, route)}
        onFollowRole={(key) => patchStep(key, { provider: '', model: '' })}
        onPin={(key) => {
          const step = steps.find((candidate) => candidate.key === key);
          if (step !== undefined) {
            patchStep(key, { provider: resolvedProvider(step), model: resolvedModel(step) });
          }
        }}
      />
    );
  };

  const launchControls = (
    <>
      {kickoff?.leading ?? null}
      <AutonomyChip
        autonomy={autonomy}
        ruleAutonomy={workflowRules.autonomy}
        disabled={busy}
        onChange={chooseAutonomy}
      />
      <StartsChip
        choice={startChoice}
        runs={activeRuns}
        disabled={busy}
        onChange={setStartChoice}
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
        disabled={busy}
        onEnabled={setIsSpendLimitEnabled}
        onAmount={setSpendLimitDraft}
        onMode={setSpendLimitMode}
        onReset={() => {
          setIsSpendLimitEnabled(workflowRules.spendLimitUsd !== null);
          setSpendLimitDraft(workflowRules.spendLimitUsd?.toString() ?? '');
          setSpendLimitMode(workflowRules.spendLimitMode);
        }}
      />
    </>
  );

  const body = (
    <div className="flex flex-col gap-6">
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
        onSubmit={() => {
          if (!startGate.isDisabled) {
            void onStart();
          }
        }}
        onUseSessionGoal={onUseSessionGoal}
        onUndo={onUndoGoal}
        onPolish={() => void onPolishGoal()}
      />
      {kickoff?.projects ?? null}
      <div className="flex flex-col gap-4">
        {modeControl === null && presetDescription === null ? null : (
          <div className="flex min-w-0 flex-col gap-2">
            {modeControl}
            {presetDescription === null ? null : (
              <p className="text-label text-muted-foreground">{presetDescription}</p>
            )}
          </div>
        )}
        {renderLane()}
        <RunGuidance
          guidance={guidance}
          ruleSummary={guidanceRuleSummary}
          hasDiff={guidanceDiffers}
          isDisabled={busy}
          tools={guidanceTools}
          footer={guidanceFooter}
          onGuidance={setGuidance}
        />
      </div>
    </div>
  );

  const storedStartError = kickoff?.startError ?? null;
  const shownError: BuilderError | null =
    error ??
    (storedStartError === null
      ? null
      : { title: "Couldn't start the run", message: storedStartError });

  const footer = (
    <div className="flex flex-col gap-3">
      <LaunchBar
        controls={launchControls}
        estimate={estimates?.total == null ? null : <PlanEstimateChip total={estimates.total} />}
        reason={startGate.reason}
        error={shownError === null ? null : `${shownError.title}. ${shownError.message}`}
        isStartDisabled={startGate.isDisabled}
        isStarting={busy}
        size={kickoff === null ? 'sm' : 'md'}
        label={kickoff?.primaryLabel ?? PRIMARY_LABEL[mode]}
        canDiscard={kickoff === null ? !draftEmpty : (kickoff.canDiscard ?? false)}
        onDiscard={kickoff?.onDiscard ?? resetDraft}
        onStart={() => void onStart()}
      />
    </div>
  );

  if (slots === undefined) {
    return (
      <div className="flex flex-col gap-8">
        {body}
        {footer}
      </div>
    );
  }

  return (
    <>
      {body}
      <Docked node={slots.actionsHost}>{footer}</Docked>
    </>
  );
};
