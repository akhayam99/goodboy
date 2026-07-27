import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Link2,
  ListChecks,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Sparkles,
  Target,
  Undo2,
  Wand2,
} from 'lucide-react';
import { Button, Divider, SectionHeader, SegmentedTabs, Skeleton, Textarea, cn } from '@goodboy/ui';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import {
  PlannerClient,
  type PlannerOutput,
  defaultsForRole,
  isWorkflowComplete,
  polishStepInstruction,
  polishWorkflowGoal,
  recommendedModelForRole,
  resolveRoleRouting,
  resolveTaskModel,
  runsForWorkflowRun,
} from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  Session,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkflowTriggerMode,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useCurrentWorkspace, useSessionSlots } from '../../../../store';
import type {
  EditableStep,
  Mode,
  WorkflowBuilderDraft,
} from '../../../../store/slices/workflowDrafts/types';
import { ROLE_LABEL, ROLE_TO_KIND, inferAgentKindFromName, type AgentKind } from '../../agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { WorkflowStepCard } from '../WorkflowStepCard';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { type EffortLevel, clampEffort } from '../../../chat/utils/chat-constants';
import { useWorkflowDrag } from '../../../workflows/hooks/useWorkflowDrag';
import { StepFlowConnector } from '../../../workflows/components/WorkflowStudio/StepFlowConnector';
import { DragGhost } from '../../../workflows/components/WorkflowStudio/DragGhost';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AttachmentChip } from '../../../chat/components/ChatInput/parts/AttachmentChip';
import { toAttachmentInput } from '../../../chat/components/ChatInput/lib';
import { usePendingAttachments } from '../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';
import { ChainAfterSelect } from './parts/ChainAfterSelect';
import { LaunchToggleRow } from './parts/LaunchToggleRow';
import { StageHeading } from './parts/StageHeading';
import { StepperRail } from './parts/StepperRail';
import { TriggerButton } from './parts/TriggerButton';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
};

type ProviderEntry = { readonly id: ProviderId; readonly connection: string };

const editableKind = (step: EditableStep): AgentKind =>
  (step.role !== 'custom' ? ROLE_TO_KIND[step.role] : undefined) ??
  inferAgentKindFromName(step.name);

const sortedSteps = (template: Workflow): Workflow['steps'] =>
  [...template.steps].sort((a, b) => a.ordinal - b.ordinal);

const stepsFromTemplate = (template: Workflow): ReadonlyArray<EditableStep> =>
  sortedSteps(template).map((s) => ({
    key: crypto.randomUUID(),
    sourceStepId: s.id,
    role: (s.role ?? 'custom') as AgentRole,
    name: s.name,
    promptPrefix: s.promptPrefix ?? '',
    expectedOutput: s.expectedOutput ?? '',
    ...(s.providerOverride && { providerOverride: s.providerOverride }),
    ...(s.modelOverride && { modelOverride: s.modelOverride }),
    ...(s.effort && { effort: s.effort as EffortLevel }),
  }));

type StepsFromPlanParams = {
  readonly plan: PlannerOutput;
  readonly roleModels: RoleModelPreferences | null;
};

const stepsFromPlan = ({ plan, roleModels }: StepsFromPlanParams): ReadonlyArray<EditableStep> =>
  plan.steps.map((s) => {
    const role = s.role as AgentRole;
    return {
      key: crypto.randomUUID(),
      role,
      name: s.name,
      promptPrefix: s.promptPrefix ?? '',
      expectedOutput: s.expectedOutput ?? '',
      effort: resolveRoleRouting({ role, prefs: roleModels }).effort as EffortLevel,
    };
  });

const stepsMatchTemplate = (steps: ReadonlyArray<EditableStep>, template: Workflow): boolean => {
  const base = sortedSteps(template);
  if (base.length !== steps.length) {
    return false;
  }
  return steps.every((s, i) => {
    const b = base[i]!;
    return (
      s.sourceStepId === b.id &&
      s.name === b.name &&
      s.promptPrefix === (b.promptPrefix ?? '') &&
      s.expectedOutput === (b.expectedOutput ?? '') &&
      s.role === ((b.role ?? 'custom') as AgentRole) &&
      (s.providerOverride ?? undefined) === (b.providerOverride ?? undefined) &&
      (s.modelOverride ?? undefined) === (b.modelOverride ?? undefined) &&
      (s.effort ?? undefined) === ((b.effort as EffortLevel | undefined) ?? undefined)
    );
  });
};

const isDraftEmpty = (d: WorkflowBuilderDraft): boolean =>
  d.goalText.trim() === '' &&
  d.goalHistory.length === 0 &&
  d.selectedPresetId === null &&
  d.basePresetId === null &&
  d.processText.trim() === '' &&
  d.plan === null &&
  d.steps.length === 0 &&
  !d.saveAsPreset &&
  !d.autoRun;

const PLANNER_EFFORT: EffortLevel = defaultsForRole('planner').effort;

type Stage = 0 | 1 | 2;

const SECTION_LABEL_CLS =
  'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70';

const initialStage = (d: WorkflowBuilderDraft | undefined): Stage => {
  if (!d) {
    return 0;
  }
  if (d.steps.length > 0 || d.plan !== null || d.selectedPresetId !== null) {
    return 2;
  }
  return d.goalText.trim().length > 0 ? 1 : 0;
};

export const WorkflowBuilderView = ({ session, onClose }: Props) => {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
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
  const roleEffort = (role: AgentRole): EffortLevel =>
    resolveRoleRouting({ role, prefs: roleModels }).effort as EffortLevel;
  const setWorkflowDraft = useAppStore((s) => s.setWorkflowDraft);
  const clearWorkflowDraft = useAppStore((s) => s.clearWorkflowDraft);
  const sessionSlots = useSessionSlots(session.id);
  const sessionWorktree = useAppStore((s) => s.sessionWorktrees?.[session.id]?.[0] ?? null);
  const { showToast } = useToast();

  const {
    attachments,
    isDragging,
    composerRef,
    fileInputRef,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({ showToast });

  const presets = phaseTemplates.filter((t) => t.isPreset !== false && !t.deletedAt);

  const [initialDraft] = useState(() => useAppStore.getState().workflowDrafts[session.id]);

  const [mode, setMode] = useState<Mode>(
    initialDraft?.mode ?? (presets.length > 0 ? 'preset' : 'custom'),
  );
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
  const [plan, setPlan] = useState<PlannerOutput | null>(initialDraft?.plan ?? null);
  const [steps, setSteps] = useState<ReadonlyArray<EditableStep>>(initialDraft?.steps ?? []);
  const [planning, setPlanning] = useState(false);
  const [polishingKey, setPolishingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saveAsPreset, setSaveAsPreset] = useState(initialDraft?.saveAsPreset ?? false);
  const [autoRun, setAutoRun] = useState(initialDraft?.autoRun ?? false);
  const [triggerMode, setTriggerMode] = useState<WorkflowTriggerMode>('immediate');
  const [chainAfterId, setChainAfterId] = useState<WorkflowRunId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(() => initialStage(initialDraft));
  const [plannerProviderOverride, setPlannerProviderOverride] = useState<ProviderId | ''>('');
  const [plannerModelOverride, setPlannerModelOverride] = useState('');

  const providerId =
    providers.find((p) => p.id === session.providerOverride)?.id ??
    session.providerPreference.defaultProvider;

  const connectedProviders = useMemo<ReadonlyArray<ProviderId>>(
    () => providers.filter((p) => p.connection === 'connected').map((p) => p.id),
    [providers],
  );

  const resolvedPlanTaskModel = useMemo(
    () => resolveTaskModel('plan_generation', workspaceOverrides?.taskModels, providerId),
    [workspaceOverrides, providerId],
  );

  const plannerEffectiveProviderId: ProviderId =
    plannerProviderOverride !== '' ? plannerProviderOverride : resolvedPlanTaskModel.providerId;

  const plannerRecommendedModel = useMemo(
    () =>
      plannerProviderOverride !== ''
        ? resolveTaskModel('plan_generation', null, plannerProviderOverride).model
        : resolvedPlanTaskModel.model,
    [plannerProviderOverride, resolvedPlanTaskModel],
  );

  const basePreset = useMemo(
    () => (basePresetId ? (presets.find((t) => t.id === basePresetId) ?? null) : null),
    [basePresetId, presets],
  );
  const presetDirty = useMemo(
    () => (basePreset ? !stepsMatchTemplate(steps, basePreset) : false),
    [basePreset, steps],
  );

  const activeRuns = useMemo(() => {
    const runs = session.workflowRuns ?? [];
    return [...runs]
      .filter((r) => !r.discardedAt)
      .map((r) => {
        const template = phaseTemplates.find((t) => t.id === r.workflowId) ?? null;
        const agents = runsForWorkflowRun(sessionPhaseRuns, r.id);
        const complete = template ? isWorkflowComplete(template, agents) : false;
        const failed = agents.some((a) => a.status === 'failed');
        return { run: r, template, complete, failed };
      })
      .filter(
        (
          e,
        ): e is {
          run: (typeof e)['run'];
          template: Workflow;
          complete: boolean;
          failed: boolean;
        } => e.template !== null && !e.complete && !e.failed,
      )
      .sort((a, b) => a.run.ordinal - b.run.ordinal);
  }, [session.workflowRuns, phaseTemplates, sessionPhaseRuns]);

  const latestActiveRunId = activeRuns[activeRuns.length - 1]?.run.id ?? null;
  const resolvedChainId = chainAfterId ?? latestActiveRunId;

  useEffect(() => {
    if (activeRuns.length === 0 && triggerMode === 'after_run') {
      setTriggerMode('immediate');
    }
  }, [activeRuns.length, triggerMode]);

  const draft: WorkflowBuilderDraft = {
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
  };
  const draftEmpty = isDraftEmpty(draft);

  useEffect(() => {
    if (draftEmpty) {
      clearWorkflowDraft(session.id);
    } else {
      setWorkflowDraft(session.id, draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  ]);

  const resetDraft = () => {
    setMode(presets.length > 0 ? 'preset' : 'custom');
    setGoalText('');
    setGoalHistory([]);
    setSelectedPresetId(null);
    setBasePresetId(null);
    setProcessText('');
    setPlan(null);
    setSteps([]);
    setSaveAsPreset(false);
    setAutoRun(false);
    setError(null);
    setStage(0);
    setExpandedKey(null);
    clearWorkflowDraft(session.id);
  };

  const handleClose = () => {
    clearWorkflowDraft(session.id);
    onClose();
  };

  const blocked = busy || planning;

  const patchStep = (key: string, patch: Partial<EditableStep>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const removeStep = (key: string) => {
    setSteps((prev) => prev.filter((s) => s.key !== key));
    setExpandedKey((cur) => (cur === key ? null : cur));
  };

  const moveStep = (key: string, dir: -1 | 1) =>
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.key === key);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved!);
      return next;
    });

  const moveStepTo = (from: number, to: number) => {
    if (to === from || to === from + 1) {
      return;
    }
    const insertAt = to > from ? to - 1 : to;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved!);
      return next;
    });
  };

  const addStep = () => {
    const key = crypto.randomUUID();
    setSteps((prev) => [
      ...prev,
      {
        key,
        role: 'custom',
        name: '',
        promptPrefix: '',
        expectedOutput: '',
        effort: roleEffort('custom'),
      },
    ]);
  };

  const { drag, dropIndex, startStepDrag, ghost } = useWorkflowDrag({
    enabled: steps.length > 0,
    onDropLibrary: () => {},
    onReorder: moveStepTo,
  });
  const dragging = drag !== null;
  const draggingKey = drag?.kind === 'step' ? (steps[drag.fromIndex]?.key ?? null) : null;

  const recommendedProvider = (_step: EditableStep): ProviderId => providerId;
  const resolvedProvider = (step: EditableStep): ProviderId =>
    step.providerOverride ?? recommendedProvider(step);
  const recommendedModel = (step: EditableStep): string =>
    recommendedModelForRole({
      role: step.role ?? 'custom',
      provider: resolvedProvider(step),
      prefs: roleModels,
    });
  const resolvedModel = (step: EditableStep): string =>
    step.modelOverride !== undefined && step.modelOverride !== ''
      ? step.modelOverride
      : recommendedModel(step);

  const onPolishStep = async (key: string) => {
    const step = steps.find((s) => s.key === key);
    if (!step || step.promptPrefix.trim().length === 0 || polishingKey) {
      return;
    }
    setError(null);
    setPolishingKey(key);
    try {
      const polished = await polishStepInstruction(
        {
          providerId,
          invokeFn: invoke,
          ...(sessionWorktree != null && { workingDir: sessionWorktree }),
        },
        { role: step.role, name: step.name, instruction: step.promptPrefix },
      );
      if (polished && polished !== step.promptPrefix) {
        patchStep(key, { promptPrefix: polished });
        return;
      }
      if (!polished) {
        showToast('error', 'could not polish the step, kept your wording');
        return;
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPolishingKey(null);
    }
  };

  const sessionGoal = (sessionSlots.find((s) => s.key === 'goal')?.value ?? '').trim();
  const selectedPreset = presets.find((t) => t.id === selectedPresetId) ?? null;
  const workspaceName = useCurrentWorkspace()?.name ?? '';

  const replaceGoal = (next: string) => {
    setGoalHistory((h) => [...h, goalText]);
    setGoalText(next);
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
      const polished = await polishWorkflowGoal(
        {
          providerId,
          invokeFn: invoke,
          ...(sessionWorktree != null && { workingDir: sessionWorktree }),
        },
        goalText,
      );
      if (polished && polished !== goalText) {
        replaceGoal(polished);
      } else if (!polished) {
        showToast('error', 'could not polish the goal, kept your wording');
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPolishing(false);
    }
  };

  const onSelectPreset = (t: Workflow) => {
    setSelectedPresetId(t.id);
    setBasePresetId(t.id);
    setSteps(stepsFromTemplate(t));
    setStage(2);
  };

  const attachOptions = () => {
    const goal = goalText.trim();
    const after = triggerMode === 'after_run' ? resolvedChainId : null;
    return {
      autoRun,
      ...(goal.length > 0 && { goal }),
      ...(triggerMode !== 'immediate' && { triggerMode }),
      ...(triggerMode === 'after_run' && after && { chainAfterId: after }),
      ...(attachments.length > 0 && { attachmentInputs: attachments.map(toAttachmentInput) }),
    };
  };

  const onPlan = async () => {
    const process = processText.trim();
    if (process.length === 0 || blocked) {
      return;
    }
    setError(null);
    setPlan(null);
    setSteps([]);
    setBasePresetId(null);
    setPlanning(true);
    try {
      const effectiveModel =
        plannerModelOverride !== '' ? plannerModelOverride : plannerRecommendedModel;
      const taskModel = { providerId: plannerEffectiveProviderId, model: effectiveModel };
      const client = new PlannerClient({
        ...taskModel,
        invokeFn: invoke,
        ...(sessionWorktree != null && { workingDir: sessionWorktree }),
      });
      const result = await client.plan({ process });
      setPlan(result.output);
      setSteps(stepsFromPlan({ plan: result.output, roleModels }));
      setStage(2);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPlanning(false);
    }
  };

  const onRedesign = () => {
    setPlan(null);
    setSteps([]);
    setError(null);
    setStage(1);
  };

  const buildSteps = (workflowId: WorkflowId): ReadonlyArray<Step> =>
    steps.map((st, ordinal) => {
      const effort = (st.effort ?? roleEffort(st.role)) as EffortLevel;
      const base: Step = {
        id: `step_builder_${crypto.randomUUID()}` as StepId,
        workflowId,
        ordinal,
        name: st.name.trim() || ROLE_LABEL[st.role],
        promptPrefix: st.promptPrefix,
        ...(st.expectedOutput.trim().length > 0 && {
          expectedOutput: st.expectedOutput.trim(),
        }),
        role: st.role,
        effort: effort as AgentEffort,
        verbosity: 'normal',
      };
      let out = base;
      if (st.providerOverride) {
        out = { ...out, providerOverride: st.providerOverride };
      }
      if (st.modelOverride) {
        out = {
          ...out,
          modelOverride: st.modelOverride,
          effort: clampEffort(st.modelOverride, effort) as AgentEffort,
        };
      }
      return out;
    });

  const onStart = async () => {
    if (blocked) {
      return;
    }
    const usePresetAsIs = mode === 'preset' && selectedPreset !== null && !presetDirty;
    if (mode === 'preset' ? selectedPreset === null : steps.length === 0) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (usePresetAsIs) {
        await attachWorkflowToSession(session.id, selectedPreset!.id, attachOptions());
        showToast('success', `workflow started: ${selectedPreset!.name}`);
        handleClose();
        return;
      }
      const now = new Date().toISOString() as Workflow['createdAt'];
      const workflowId = `wf_builder_${crypto.randomUUID()}` as WorkflowId;
      const name =
        mode === 'custom'
          ? (plan?.workflowName ?? 'Custom workflow')
          : (selectedPreset?.name ?? basePreset?.name ?? 'Custom workflow');
      const description =
        mode === 'custom'
          ? (plan?.reasoning ?? '')
          : (selectedPreset?.description ?? basePreset?.description ?? '');
      const goal = goalText.trim();
      const process = mode === 'custom' ? processText.trim() : '';
      const workflow: Workflow = {
        id: workflowId,
        workspaceId: session.workspaceId,
        name,
        description,
        ...(goal.length > 0 && { goal }),
        ...(process.length > 0 && { processText: process }),
        steps: buildSteps(workflowId),
        isPreset: saveAsPreset,
        createdAt: now,
        updatedAt: now,
      };
      await savePhaseTemplate(workflow);
      await attachWorkflowToSession(session.id, workflowId, attachOptions());
      showToast('success', `workflow started: ${name}`);
      handleClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const startDisabled =
    blocked || (mode === 'preset' ? selectedPreset === null : steps.length === 0);
  const canAdvanceFromApproach = mode === 'preset' ? selectedPreset !== null : plan !== null;
  const canContinue =
    (stage === 0 && goalText.trim().length > 0) || (stage === 1 && canAdvanceFromApproach);
  const continueHint =
    stage === 1 && !canAdvanceFromApproach
      ? mode === 'preset'
        ? 'Select a preset to continue'
        : 'Generate a plan to continue'
      : null;
  const stageReachable = (i: Stage): boolean => {
    if (i <= stage) return true;
    if (goalText.trim().length === 0) return false;
    return i < 2 || canAdvanceFromApproach;
  };
  const goNext = () => {
    if (canContinue) {
      setStage((s) => Math.min(s + 1, 2) as Stage);
    }
  };
  const goBack = () => setStage((s) => Math.max(s - 1, 0) as Stage);
  const jumpStage = (i: Stage) => {
    if (stageReachable(i)) {
      setStage(i);
    }
  };

  const stepCount = steps.length;
  const showSteps = steps.length > 0;
  const customReady = mode === 'custom' && plan !== null;
  const workflowName =
    mode === 'custom'
      ? (plan?.workflowName ?? 'Custom workflow')
      : (selectedPreset?.name ?? basePreset?.name ?? 'Workflow');

  return (
    <StudioShell
      icon={Sparkles}
      title="Start a workflow"
      workspaceName={workspaceName}
      closeLabel="cancel workflow builder"
      onClose={handleClose}
      variant="slot"
    >
      {() => (
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <StepperRail
            current={stage}
            canReach={stageReachable}
            disabled={blocked}
            onJump={jumpStage}
          />
          <Divider />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              key={stage}
              className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 py-7 motion-safe:animate-fade-in"
            >
              {stage === 0 ? (
                <>
                  <StageHeading
                    title="What's the goal?"
                    subtitle="Set the objective and attach any files. Every step in the workflow works toward this."
                  />
                  <section className="flex flex-col gap-2">
                    <SectionHeader
                      icon={<Target size={11} aria-hidden />}
                      label="Goal"
                      htmlFor="workflow-goal"
                      action={
                        <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                          {sessionGoal.length > 0 ? (
                            <button
                              type="button"
                              onClick={onUseSessionGoal}
                              disabled={blocked || polishing || goalText === sessionGoal}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-2xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Target size={10} aria-hidden /> Use session goal
                            </button>
                          ) : null}
                          {goalHistory.length > 0 ? (
                            <button
                              type="button"
                              onClick={onUndoGoal}
                              disabled={blocked || polishing}
                              aria-label="undo goal change"
                              className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Undo2 size={10} aria-hidden /> Undo
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void onPolishGoal()}
                            disabled={blocked || polishing || goalText.trim().length === 0}
                            aria-label="polish goal"
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                              polishing && 'animate-border-pulse',
                            )}
                          >
                            <Wand2 size={10} aria-hidden />
                            Polish
                          </button>
                        </div>
                      }
                    />
                    <Textarea
                      id="workflow-goal"
                      value={goalText}
                      onChange={(e) => setGoalText(e.target.value)}
                      placeholder="what should this workflow accomplish? same as the session, or a specific sub-objective (e.g. just the auth module)…"
                      autoGrow
                      minRows={3}
                      maxRows={4}
                      disabled={busy || polishing}
                      className="resize-none rounded-lg bg-subtle/80 px-4 py-3 text-sm ring-1 ring-border-soft focus-visible:ring-foreground/15"
                    />
                    <p className="px-1 text-2xs leading-relaxed text-muted-foreground/60">
                      Every step works toward this goal.
                    </p>
                  </section>

                  <Divider />

                  <section className="flex flex-col gap-2">
                    <SectionHeader icon={<Paperclip size={11} aria-hidden />} label="Attachments" />
                    <div
                      ref={composerRef}
                      data-drop-composer
                      className={cn(
                        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
                        isDragging
                          ? 'border-dashed border-primary bg-primary/5'
                          : 'border-border-soft',
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ATTACHMENT_ACCEPT}
                        multiple
                        hidden
                        onChange={onFileInputChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={blocked}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs transition-colors',
                          blocked
                            ? 'cursor-not-allowed text-muted-foreground/40'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <Paperclip size={13} aria-hidden /> Add files
                      </button>
                      {attachments.length > 0 ? (
                        <>
                          {attachments.map((a) => (
                            <AttachmentChip
                              key={a.id}
                              attachment={a}
                              onRemove={() => removeAttachment(a.id)}
                            />
                          ))}
                        </>
                      ) : (
                        <span className="text-2xs text-muted-foreground/60">
                          Drop or add files. Routed to the agents that need them.
                        </span>
                      )}
                    </div>
                  </section>
                </>
              ) : null}

              {stage === 1 ? (
                <>
                  <StageHeading
                    title="How do you want to build it?"
                    subtitle="Start from a preset and customize, or describe a flow and let the planner draft the steps."
                  />
                  <section className="flex flex-col gap-3">
                    <SectionHeader
                      icon={<SECTION_ICONS.workflows size={11} aria-hidden />}
                      label="Approach"
                      action={
                        <SegmentedTabs
                          ariaLabel="workflow approach"
                          options={[
                            {
                              value: 'preset',
                              label: 'Preset',
                              icon: ListChecks,
                              disabled: blocked,
                            },
                            {
                              value: 'custom',
                              label: 'Custom',
                              icon: Sparkles,
                              disabled: blocked,
                            },
                          ]}
                          value={mode}
                          onChange={setMode}
                          size="sm"
                        />
                      }
                    />

                    {mode === 'preset' ? (
                      <div className="flex flex-col gap-2">
                        {presets.length === 0 ? (
                          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-border-soft px-4 py-5">
                            <p className="text-xs text-muted-foreground">
                              No presets in this workspace yet.
                            </p>
                            <button
                              type="button"
                              onClick={() => setMode('custom')}
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10"
                            >
                              <Sparkles size={12} aria-hidden /> Describe your own
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="px-1 text-2xs leading-relaxed text-muted-foreground/60">
                              Pick a preset. Tune its steps on the next screen before starting.
                            </p>
                            <div
                              className="flex flex-col gap-1.5"
                              role="radiogroup"
                              aria-label="presets"
                            >
                              {presets.map((t) => {
                                const tSteps = sortedSteps(t);
                                const kinds = tSteps.map((s) =>
                                  s.role ? ROLE_TO_KIND[s.role] : inferAgentKindFromName(s.name),
                                );
                                const shown = kinds.slice(0, 5);
                                const selected = t.id === selectedPresetId;
                                const desc = t.description || t.goal;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onSelectPreset(t)}
                                    disabled={busy}
                                    className={cn(
                                      'flex items-center gap-2.5 rounded-lg border border-l-2 px-3 py-2 text-left transition-colors',
                                      selected
                                        ? 'border-l-primary border-border-soft bg-subtle'
                                        : 'border-l-transparent border-border-soft hover:border-border hover:bg-muted/40',
                                      busy && 'cursor-not-allowed opacity-60',
                                    )}
                                  >
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                      <span className="flex items-center gap-1.5">
                                        <span className="min-w-0 truncate text-xs font-medium text-foreground">
                                          {t.name}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                                          {tSteps.length}
                                        </span>
                                      </span>
                                      {desc ? (
                                        <span className="truncate text-[10px] leading-snug text-muted-foreground/70">
                                          {desc}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1">
                                      {shown.map((k, i) => (
                                        <AgentAvatar key={`${k}-${i}`} kind={k} size="xs" />
                                      ))}
                                      {kinds.length > shown.length ? (
                                        <span className="text-[10px] text-muted-foreground/40">
                                          +{kinds.length - shown.length}
                                        </span>
                                      ) : null}
                                    </span>
                                    {selected ? (
                                      <Check
                                        size={13}
                                        className="shrink-0 text-primary"
                                        aria-hidden
                                      />
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="px-1 text-2xs leading-relaxed text-muted-foreground/60">
                          Describe the flow. The planner drafts ordered steps you tune before
                          starting.
                        </p>
                        <div className="rounded-lg bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15">
                          <div className="relative">
                            <Textarea
                              value={processText}
                              onChange={(e) => setProcessText(e.target.value)}
                              placeholder="describe the process you expect (e.g. read the existing github integration, study how it works, then plan the gitlab equivalent, then implement)…"
                              autoGrow
                              minRows={4}
                              maxRows={9}
                              className="min-h-20 resize-none border-0 bg-transparent px-4 pt-3 pb-12 text-sm shadow-none focus-visible:ring-0"
                            />
                            <div className="absolute bottom-2.5 right-2.5">
                              <Button
                                size="sm"
                                onClick={() => void onPlan()}
                                disabled={blocked || processText.trim().length === 0}
                                className={cn('min-w-[6.5rem]', planning && 'animate-border-pulse')}
                              >
                                {planning ? 'Planning…' : plan ? 'Re-plan' : 'Generate plan'}
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end px-1">
                          <div className="w-64">
                            <RoutingPicker
                              ariaLabel="planner routing"
                              connectedProviders={connectedProviders}
                              provider={plannerProviderOverride}
                              model={plannerModelOverride}
                              effort={{ editable: false, value: PLANNER_EFFORT }}
                              recommendation={{
                                provider: resolvedPlanTaskModel.providerId,
                                model: plannerRecommendedModel,
                              }}
                              disabled={blocked}
                              onProvider={(next) => {
                                setPlannerProviderOverride(next);
                                setPlannerModelOverride('');
                              }}
                              onModel={setPlannerModelOverride}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              ) : null}

              {stage === 2 ? (
                <>
                  <StageHeading
                    title="Tune your steps"
                    subtitle="Reorder, edit instructions, and pick a model and provider for each agent."
                  />
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {workflowName}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {customReady ? (
                          <button
                            type="button"
                            onClick={onRedesign}
                            disabled={blocked}
                            className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Sparkles size={10} aria-hidden /> Re-design
                          </button>
                        ) : null}
                        {mode === 'custom' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-medium text-success">
                            <Check size={10} aria-hidden /> Ready
                          </span>
                        ) : presetDirty ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-2xs font-medium text-warning">
                            <Pencil size={9} aria-hidden /> Customized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-medium text-success">
                            <Check size={10} aria-hidden /> Selected
                          </span>
                        )}
                      </div>
                    </div>

                    {showSteps ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className={SECTION_LABEL_CLS}>
                            <ListChecks size={11} aria-hidden /> Steps
                          </span>
                          <span className="text-2xs tabular-nums text-muted-foreground/60">
                            {stepCount} step{stepCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <ol className="flex flex-col" aria-label="workflow steps">
                          {steps.map((st, i) => (
                            <Fragment key={st.key}>
                              <StepFlowConnector
                                index={i}
                                interior={i > 0}
                                dragging={dragging}
                                active={dropIndex === i}
                              />
                              <WorkflowStepCard
                                ordinal={i}
                                kind={editableKind(st)}
                                role={st.role}
                                provider={resolvedProvider(st)}
                                providerValue={st.providerOverride ?? ''}
                                recommendedProvider={recommendedProvider(st)}
                                connectedProviders={connectedProviders}
                                name={st.name}
                                promptPrefix={st.promptPrefix}
                                expectedOutput={st.expectedOutput}
                                model={st.modelOverride ?? ''}
                                resolvedModel={resolvedModel(st)}
                                recommendedModel={recommendedModel(st)}
                                effort={(st.effort ?? roleEffort(st.role)) as EffortLevel}
                                expanded={expandedKey === st.key}
                                dragging={draggingKey === st.key}
                                disabled={busy}
                                polishing={polishingKey === st.key}
                                onExpand={() => setExpandedKey(st.key)}
                                onCollapse={() =>
                                  setExpandedKey((cur) => (cur === st.key ? null : cur))
                                }
                                onStartDrag={(e) =>
                                  startStepDrag(i, st.name.trim() || ROLE_LABEL[st.role], e)
                                }
                                onName={(v) => patchStep(st.key, { name: v })}
                                onPrompt={(v) => patchStep(st.key, { promptPrefix: v })}
                                onExpectedOutput={(v) => patchStep(st.key, { expectedOutput: v })}
                                onModel={(v) =>
                                  patchStep(st.key, {
                                    modelOverride: v || undefined,
                                    effort: clampEffort(v, st.effort ?? roleEffort(st.role)),
                                  })
                                }
                                onProvider={(v) =>
                                  patchStep(st.key, { providerOverride: v || undefined })
                                }
                                onEffort={(v) => patchStep(st.key, { effort: v })}
                                onPolish={() => void onPolishStep(st.key)}
                                onRemove={() => removeStep(st.key)}
                                onMoveUp={() => moveStep(st.key, -1)}
                                onMoveDown={() => moveStep(st.key, 1)}
                              />
                            </Fragment>
                          ))}
                          <StepFlowConnector
                            index={steps.length}
                            interior={false}
                            dragging={dragging}
                            active={dropIndex === steps.length}
                          />
                        </ol>
                        <button
                          type="button"
                          onClick={addStep}
                          disabled={busy}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-soft px-2.5 py-1.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size={11} aria-hidden /> Add step
                        </button>
                        <p className="px-1 text-2xs leading-relaxed text-muted-foreground/50">
                          Each step is one agent; its output feeds the next. Drag to reorder.
                        </p>
                        <DragGhost ghost={ghost} />
                      </div>
                    ) : planning ? (
                      <div
                        role="status"
                        aria-label="Drafting plan"
                        className="flex flex-col gap-1.5"
                      >
                        <Skeleton className="h-3 w-28 rounded" />
                        <ol className="flex flex-col divide-y divide-border-soft/50">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <li key={i} className="flex flex-col gap-1.5 px-1 py-3 first:pt-1">
                              <div className="flex items-center gap-2">
                                <span className="w-3 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground/40">
                                  {i + 1}
                                </span>
                                <Skeleton className="size-4 shrink-0 rounded-full" />
                                <Skeleton className="h-3 flex-1 rounded" />
                              </div>
                              <div className="flex flex-col gap-1 pl-5">
                                <Skeleton className="h-2 w-full rounded" />
                                <Skeleton className="h-2 w-4/5 rounded" />
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-soft px-4 py-8 text-center">
                        <SECTION_ICONS.workflows
                          size={22}
                          className="text-muted-foreground/30"
                          aria-hidden
                        />
                        <p className="text-xs font-medium text-foreground">
                          {mode === 'preset' ? 'No preset selected' : 'No plan yet'}
                        </p>
                        <p className="max-w-[18rem] text-2xs leading-relaxed text-muted-foreground">
                          {mode === 'preset'
                            ? 'Go back and pick a preset to load its steps here.'
                            : 'Go back and generate a plan to draft steps here.'}
                        </p>
                      </div>
                    )}
                  </section>

                  <Divider />

                  <section className="flex flex-col gap-3">
                    <SectionHeader icon={<Rocket size={11} aria-hidden />} label="Launch options" />
                    <div className="flex flex-col divide-y divide-border-soft/70 overflow-hidden rounded-lg border border-border-soft bg-subtle/40">
                      <div className="flex flex-col gap-2 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xs font-medium text-foreground">
                            When to start
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex w-fit items-center gap-0 rounded-md bg-background/80 p-0.5 ring-1 ring-border-soft">
                              <TriggerButton
                                active={triggerMode === 'immediate'}
                                disabled={blocked}
                                onClick={() => setTriggerMode('immediate')}
                                icon={<Play size={11} aria-hidden />}
                                label="Start now"
                              />
                              <TriggerButton
                                active={triggerMode === 'manual'}
                                disabled={blocked}
                                onClick={() => setTriggerMode('manual')}
                                icon={<Hand size={11} aria-hidden />}
                                label="Start manually"
                              />
                              {activeRuns.length > 0 ? (
                                <TriggerButton
                                  active={triggerMode === 'after_run'}
                                  disabled={blocked}
                                  onClick={() => {
                                    setTriggerMode('after_run');
                                    if (chainAfterId === null) {
                                      setChainAfterId(latestActiveRunId);
                                    }
                                  }}
                                  icon={<Link2 size={11} aria-hidden />}
                                  label="Run after"
                                />
                              ) : null}
                            </div>
                            {triggerMode === 'after_run' && activeRuns.length > 0 ? (
                              <ChainAfterSelect
                                runs={activeRuns}
                                value={resolvedChainId}
                                disabled={blocked}
                                onChange={setChainAfterId}
                              />
                            ) : null}
                          </div>
                        </div>
                        <p className="text-2xs leading-relaxed text-muted-foreground/60">
                          {triggerMode === 'immediate'
                            ? 'Runs as soon as you start it.'
                            : triggerMode === 'manual'
                              ? 'Stays queued until you start it from the sidebar.'
                              : `Starts after ${
                                  activeRuns.find((e) => e.run.id === resolvedChainId)?.template
                                    .name ?? 'the selected workflow'
                                } completes.`}
                        </p>
                      </div>
                      <LaunchToggleRow
                        title="Auto-run"
                        description="Each step runs as soon as the previous finishes. No manual hand-off."
                        beta
                        checked={autoRun}
                        onChange={setAutoRun}
                        disabled={busy}
                      />
                      {mode === 'custom' || presetDirty ? (
                        <LaunchToggleRow
                          title="Save as preset"
                          description="Reuse this configuration in your workspace."
                          checked={saveAsPreset}
                          onChange={setSaveAsPreset}
                          disabled={busy}
                        />
                      ) : null}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </div>

          <Divider />

          <footer className="shrink-0">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-6 py-4">
              <div className="flex min-w-0 items-center gap-2">
                {!draftEmpty ? (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={resetDraft}
                    disabled={busy}
                    aria-label="reset workflow draft"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <RotateCcw size={14} aria-hidden />
                    Reset
                  </Button>
                ) : null}
                {error ? (
                  <span
                    role="alert"
                    className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-danger"
                  >
                    <AlertTriangle size={12} className="shrink-0" aria-hidden />
                    {error}
                  </span>
                ) : continueHint ? (
                  <span className="truncate text-2xs text-muted-foreground/60">{continueHint}</span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {stage > 0 ? (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={goBack}
                    disabled={blocked}
                    className="gap-1"
                  >
                    <ChevronLeft size={14} aria-hidden />
                    Back
                  </Button>
                ) : null}
                {stage < 2 ? (
                  <Button
                    size="md"
                    onClick={goNext}
                    disabled={blocked || !canContinue}
                    className="gap-1"
                  >
                    Continue
                    <ChevronRight size={14} aria-hidden />
                  </Button>
                ) : (
                  <Button
                    size="md"
                    onClick={() => void onStart()}
                    disabled={startDisabled}
                    className={cn(busy && 'animate-border-pulse')}
                  >
                    {busy ? 'Starting…' : 'Start workflow'}
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </div>
      )}
    </StudioShell>
  );
};
