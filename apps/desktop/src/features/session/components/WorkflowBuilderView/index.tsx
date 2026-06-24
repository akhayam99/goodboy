import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Hand,
  Layers,
  Link2,
  ListChecks,
  Paperclip,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Undo2,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Button, Divider, Input, Skeleton, Textarea, cn } from '@goodboy/ui';
import {
  PlannerClient,
  type PlannerOutput,
  autoModelForRole,
  defaultsForRole,
  getDefaultTurnModel,
  isWorkflowComplete,
  polishWorkflowGoal,
  runsForWorkflowRun,
} from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
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
  Mode,
  StepEdit,
  WorkflowBuilderDraft,
} from '../../../../store/slices/workflowDrafts/types';
import {
  AGENT_KIND_PALETTE,
  ROLE_LABEL,
  ROLE_TO_KIND,
  inferAgentKindFromName,
  type AgentKind,
} from '../../agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { ModelSelect } from '../ModelSelect';
import { EffortSelect } from '../EffortSelect';
import {
  EFFORT_LABEL,
  type EffortLevel,
  clampEffort,
  modelLabel,
} from '../../../chat/utils/chat-constants';
import { formatError } from '../../../../shared/lib/errors';
import { ToggleSwitch } from '../../../../shared/components/ToggleSwitch';
import { useToast } from '../../../../app/components/Toast';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';
import { POPUP_BASE, POPUP_DOWN, POPUP_UP } from '../dropdown-utils';
import { AttachmentChip } from '../../../chat/components/ChatInput/parts/AttachmentChip';
import { toAttachmentInput } from '../../../chat/components/ChatInput/lib';
import { usePendingAttachments } from '../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';

type Props = {
  readonly session: Session;
  readonly onClose: () => void;
};

const planStepKind = (step: PlannerOutput['steps'][number]): AgentKind =>
  ROLE_TO_KIND[step.role as AgentRole] ?? inferAgentKindFromName(step.name);

const templateStepKind = (step: Workflow['steps'][number]): AgentKind =>
  step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);

const sortedSteps = (template: Workflow): Workflow['steps'] =>
  [...template.steps].sort((a, b) => a.ordinal - b.ordinal);

const pruneToDirty = (edits: Record<number, StepEdit>): Record<number, StepEdit> => {
  const kept: Record<number, StepEdit> = {};
  for (const [k, v] of Object.entries(edits)) {
    if (v.dirty) {
      kept[Number(k)] = v;
    }
  }
  return kept;
};

const isDraftEmpty = (d: WorkflowBuilderDraft): boolean =>
  d.goalText.trim() === '' &&
  d.goalHistory.length === 0 &&
  d.selectedPresetId === null &&
  d.processText.trim() === '' &&
  d.plan === null &&
  Object.keys(d.stepEdits).length === 0 &&
  !d.saveAsPreset &&
  !d.autoRun;

export const WorkflowBuilderView = ({ session, onClose }: Props) => {
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionPhaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns?.[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<never>),
  );
  const providers = useAppStore((s) => s.providers ?? (EMPTY_ARRAY as ReadonlyArray<never>));
  const setWorkflowDraft = useAppStore((s) => s.setWorkflowDraft);
  const clearWorkflowDraft = useAppStore((s) => s.clearWorkflowDraft);
  const sessionSlots = useSessionSlots(session.id);
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
  const [processText, setProcessText] = useState(initialDraft?.processText ?? '');
  const [plan, setPlan] = useState<PlannerOutput | null>(initialDraft?.plan ?? null);
  const [stepEdits, setStepEdits] = useState<Record<number, StepEdit>>(
    initialDraft?.stepEdits ?? {},
  );
  const [planning, setPlanning] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(initialDraft?.saveAsPreset ?? false);
  const [autoRun, setAutoRun] = useState(initialDraft?.autoRun ?? false);
  const [triggerMode, setTriggerMode] = useState<WorkflowTriggerMode>('immediate');
  const [chainAfterId, setChainAfterId] = useState<WorkflowRunId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  const activeRuns = useMemo(() => {
    const runs = session.workflowRuns ?? [];
    return [...runs]
      .filter((r) => !r.discardedAt)
      .map((r) => {
        const template = phaseTemplates.find((t) => t.id === r.workflowId) ?? null;
        const agents = runsForWorkflowRun(sessionPhaseRuns, r.id);
        const complete = template ? isWorkflowComplete(template, agents) : false;
        return { run: r, template, complete };
      })
      .filter(
        (e): e is { run: (typeof e)['run']; template: Workflow; complete: boolean } =>
          e.template !== null && !e.complete,
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
    processText,
    plan,
    stepEdits,
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
    processText,
    plan,
    stepEdits,
    saveAsPreset,
    autoRun,
  ]);

  const resetDraft = () => {
    setMode(presets.length > 0 ? 'preset' : 'custom');
    setGoalText('');
    setGoalHistory([]);
    setSelectedPresetId(null);
    setProcessText('');
    setPlan(null);
    setStepEdits({});
    setSaveAsPreset(false);
    setAutoRun(false);
    setError(null);
    clearWorkflowDraft(session.id);
  };

  const handleClose = () => {
    clearWorkflowDraft(session.id);
    onClose();
  };

  const providerId =
    providers.find((p) => p.id === session.providerOverride)?.id ??
    session.providerPreference.defaultProvider;
  const blocked = busy || planning;

  const patchStep = (i: number, patch: Partial<StepEdit>) =>
    setStepEdits((prev) => ({ ...prev, [i]: { ...prev[i], ...patch, dirty: true } }));

  const effortModelFor = (i: number, role: AgentRole): string => {
    const picked = stepEdits[i]?.model;
    if (picked) {
      return picked;
    }
    return autoModelForRole(role, [providerId])?.model ?? getDefaultTurnModel(providerId);
  };
  const sessionGoal = (sessionSlots.find((s) => s.key === 'goal')?.value ?? '').trim();
  const selectedPreset = presets.find((t) => t.id === selectedPresetId) ?? null;
  // Right column is always populated: fall back to the first/recommended preset for the
  // live preview when nothing is explicitly picked. Start gating still requires selectedPreset.
  const previewPreset = selectedPreset ?? presets[0] ?? null;
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
      const polished = await polishWorkflowGoal({ providerId, invokeFn: invoke }, goalText);
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

  const onStartPreset = async () => {
    if (!selectedPreset || blocked) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await attachWorkflowToSession(session.id, selectedPreset.id, attachOptions());
      showToast('success', `workflow started: ${selectedPreset.name}`);
      handleClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const onPlan = async () => {
    const process = processText.trim();
    if (process.length === 0 || blocked) {
      return;
    }
    setError(null);
    setPlan(null);
    setStepEdits((prev) => pruneToDirty(prev));
    setPlanning(true);
    try {
      const client = new PlannerClient({ providerId, invokeFn: invoke });
      const result = await client.plan({ process });
      setPlan(result.output);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPlanning(false);
    }
  };

  const onRedesign = () => {
    setPlan(null);
    setStepEdits((prev) => pruneToDirty(prev));
    setError(null);
    promptRef.current?.querySelector('textarea')?.focus();
  };

  const onStartCustom = async () => {
    if (!plan || blocked) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const now = new Date().toISOString() as Workflow['createdAt'];
      const workflowId = `wf_planner_${crypto.randomUUID()}` as WorkflowId;
      const steps: ReadonlyArray<Step> = plan.steps.map((s, ordinal) => {
        const defaults = defaultsForRole(s.role);
        const edit = stepEdits[ordinal];
        const name = (edit?.name ?? s.name).trim() || s.name;
        const promptPrefix = edit?.promptPrefix ?? s.promptPrefix;
        const picked = edit?.model ?? '';
        const baseEffort = (edit?.effort ?? defaults.effort) as EffortLevel;
        const base: Step = {
          id: `step_planner_${crypto.randomUUID()}` as StepId,
          workflowId,
          ordinal,
          name,
          promptPrefix,
          role: s.role as AgentRole,
          effort: baseEffort as AgentEffort,
          verbosity: 'normal',
        };
        if (picked === '') {
          return base;
        }
        return {
          ...base,
          modelOverride: picked,
          effort: clampEffort(picked, baseEffort) as AgentEffort,
        };
      });
      const goal = goalText.trim();
      const workflow: Workflow = {
        id: workflowId,
        workspaceId: session.workspaceId,
        name: plan.workflowName,
        description: plan.reasoning,
        ...(goal.length > 0 && { goal }),
        steps,
        isPreset: saveAsPreset,
        createdAt: now,
        updatedAt: now,
      };
      await savePhaseTemplate(workflow);
      await attachWorkflowToSession(session.id, workflowId, attachOptions());
      showToast('success', `workflow started: ${plan.workflowName}`);
      handleClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const startDisabled = blocked || (mode === 'preset' ? !selectedPreset : !plan);
  const onStart = mode === 'preset' ? onStartPreset : onStartCustom;

  return (
    <StudioShell
      icon={Sparkles}
      title="Start a workflow"
      workspaceName={workspaceName}
      closeLabel="cancel workflow builder"
      onClose={handleClose}
      variant="slot"
      headerAccessory={
        !draftEmpty ? (
          <button
            type="button"
            onClick={resetDraft}
            disabled={blocked}
            title="Clear the whole draft — goal, approach, steps and start settings (keeps this panel open)"
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground motion-safe:transition-colors',
              'hover:bg-muted/50 hover:text-foreground',
              blocked && 'cursor-not-allowed opacity-50',
            )}
            aria-label="reset workflow draft"
          >
            <RotateCcw size={11} aria-hidden /> Reset draft
          </button>
        ) : null
      }
    >
      {() => (
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-[5] flex-col overflow-y-auto p-4">
              <div className="flex w-full flex-col gap-6">
                <section className="flex flex-col gap-2">
                  <SectionHeader icon={Target} label="Goal" htmlFor="workflow-goal">
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
                  </SectionHeader>
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

                <section className="flex flex-col gap-3">
                  <SectionHeader icon={Layers} label="Approach">
                    <div className="flex items-center gap-0.5 rounded-md bg-subtle/80 p-0.5 ring-1 ring-border-soft">
                      <button
                        type="button"
                        onClick={() => setMode('preset')}
                        disabled={blocked}
                        aria-pressed={mode === 'preset'}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-2xs font-medium transition-colors',
                          mode === 'preset'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <ListChecks size={11} aria-hidden /> Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('custom')}
                        disabled={blocked}
                        aria-pressed={mode === 'custom'}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-2xs font-medium transition-colors',
                          mode === 'custom'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Sparkles size={11} aria-hidden /> Custom
                      </button>
                    </div>
                  </SectionHeader>

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
                            Pick a preset. Its ordered steps show on the right.
                          </p>
                          <div
                            className="flex flex-col gap-1.5"
                            role="radiogroup"
                            aria-label="presets"
                          >
                            {presets.map((t) => {
                              const steps = sortedSteps(t);
                              const kinds = steps.map(templateStepKind);
                              const shown = kinds.slice(0, 5);
                              const selected = t.id === selectedPresetId;
                              const desc = t.description || t.goal;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={selected}
                                  onClick={() => setSelectedPresetId(t.id)}
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
                                        {steps.length}
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
                        Describe the flow. The planner drafts ordered steps you tune on the right
                        before starting.
                      </p>
                      <div
                        ref={promptRef}
                        className="rounded-lg bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15"
                      >
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
                        <span className="text-2xs text-muted-foreground/60">
                          cheap-tier · {providerId}
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                <Divider />

                <section className="flex flex-col gap-2">
                  <SectionHeader icon={Paperclip} label="Attachments" />
                  <div
                    ref={composerRef}
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
                        Drop or add files — routed to the agents that need them.
                      </span>
                    )}
                  </div>
                </section>

                <Divider />

                <section className="flex flex-col gap-2">
                  <SectionHeader icon={Play} label="When to start" />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex w-fit items-center gap-0.5 rounded-lg bg-subtle/80 p-0.5 ring-1 ring-border-soft">
                      <TriggerButton
                        active={triggerMode === 'immediate'}
                        disabled={blocked}
                        onClick={() => setTriggerMode('immediate')}
                        icon={<Play size={12} aria-hidden />}
                        label="Start now"
                      />
                      <TriggerButton
                        active={triggerMode === 'manual'}
                        disabled={blocked}
                        onClick={() => setTriggerMode('manual')}
                        icon={<Hand size={12} aria-hidden />}
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
                          icon={<Link2 size={12} aria-hidden />}
                          label="Run after"
                        />
                      ) : null}
                    </div>
                    {triggerMode === 'after_run' && activeRuns.length > 1 ? (
                      <ChainAfterSelect
                        runs={activeRuns}
                        value={resolvedChainId}
                        disabled={blocked}
                        onChange={setChainAfterId}
                      />
                    ) : null}
                  </div>
                  <p className="px-1 text-2xs leading-relaxed text-muted-foreground/60">
                    {triggerMode === 'immediate'
                      ? 'Runs as soon as you start it.'
                      : triggerMode === 'manual'
                        ? 'Stays queued until you start it from the sidebar.'
                        : `Starts after ${
                            activeRuns.find((e) => e.run.id === resolvedChainId)?.template.name ??
                            'the selected workflow'
                          } completes.`}
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border-soft bg-subtle/40 px-3 py-1.5">
                    <p className="text-2xs leading-relaxed text-muted-foreground/60">
                      Auto-run: each step runs as soon as the previous finishes — no manual
                      hand-off.
                    </p>
                    <ToggleSwitch
                      label="Auto-run"
                      beta
                      checked={autoRun}
                      onChange={setAutoRun}
                      disabled={busy}
                    />
                  </div>
                </section>
              </div>
            </div>

            <div className="hidden min-w-0 flex-[4] shrink-0 flex-col overflow-hidden border-l border-border-soft bg-subtle/40 lg:flex">
              <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-2">
                <span className={SECTION_LABEL_CLS}>
                  <ListChecks size={11} aria-hidden /> Step preview
                </span>
                {(mode === 'preset' ? previewPreset : plan) ? (
                  <span className="text-2xs tabular-nums text-muted-foreground/60">
                    {mode === 'preset' ? previewPreset!.steps.length : plan!.steps.length} step
                    {(mode === 'preset' ? previewPreset!.steps.length : plan!.steps.length) === 1
                      ? ''
                      : 's'}
                  </span>
                ) : null}
                {mode === 'custom' && plan ? (
                  <button
                    type="button"
                    onClick={onRedesign}
                    disabled={blocked}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={10} aria-hidden /> Re-design
                  </button>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
                {mode === 'preset' ? (
                  previewPreset ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {previewPreset.name}
                        </span>
                        {selectedPreset ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-success">
                            <Check size={10} aria-hidden /> Selected
                          </span>
                        ) : (
                          <span className="text-2xs text-muted-foreground/50">Recommended</span>
                        )}
                      </div>
                      <ol className="flex flex-col divide-y divide-border-soft/50">
                        {sortedSteps(previewPreset).map((s, i) => (
                          <ReadOnlyStepCard
                            key={s.id}
                            ordinal={i}
                            kind={templateStepKind(s)}
                            name={s.name}
                            role={s.role ?? 'custom'}
                            model={s.modelOverride}
                            effort={s.effort}
                            promptPrefix={s.promptPrefix}
                          />
                        ))}
                      </ol>
                      <p className="px-1 pt-1 text-2xs leading-relaxed text-muted-foreground/50">
                        Each step is one agent; its output feeds the next.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                      <Layers size={22} className="text-muted-foreground/30" aria-hidden />
                      <p className="text-xs font-medium text-foreground">No preset selected</p>
                      <p className="max-w-[15rem] text-2xs leading-relaxed text-muted-foreground">
                        Pick a preset and its ordered steps show here.
                      </p>
                    </div>
                  )
                ) : plan ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {plan.workflowName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-2xs text-success">
                        <Check size={10} aria-hidden /> Workflow ready
                      </span>
                    </div>
                    <ol className="flex flex-col divide-y divide-border-soft/50">
                      {plan.steps.map((s, i) => {
                        const role = s.role as AgentRole;
                        const edit = stepEdits[i];
                        return (
                          <EditableStepCard
                            key={`${i}-${s.name}`}
                            ordinal={i}
                            kind={planStepKind(s)}
                            provider={providerId}
                            name={edit?.name ?? s.name}
                            promptPrefix={edit?.promptPrefix ?? s.promptPrefix}
                            model={edit?.model ?? ''}
                            effort={(edit?.effort ?? defaultsForRole(role).effort) as EffortLevel}
                            effortModel={effortModelFor(i, role)}
                            disabled={busy}
                            onName={(v) => patchStep(i, { name: v })}
                            onPrompt={(v) => patchStep(i, { promptPrefix: v })}
                            onModel={(v) => patchStep(i, { model: v })}
                            onEffort={(v) => patchStep(i, { effort: v })}
                          />
                        );
                      })}
                    </ol>
                    <p className="px-1 pt-1 text-2xs leading-relaxed text-muted-foreground/50">
                      Each step is one agent; its output feeds the next.
                    </p>
                  </div>
                ) : planning ? (
                  <div role="status" aria-label="Drafting plan" className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-28 rounded" />
                    </div>
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
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                    <Layers size={22} className="text-muted-foreground/30" aria-hidden />
                    <p className="text-xs font-medium text-foreground">No plan yet</p>
                    <p className="max-w-[15rem] text-2xs leading-relaxed text-muted-foreground">
                      Describe your flow and the planner drafts ordered steps here, each with its
                      own model pick.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Divider />

          <footer className="flex shrink-0 items-center gap-3 px-6 py-4">
            <div className="flex-1">
              {error ? (
                <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
                  <AlertTriangle size={12} aria-hidden />
                  {error}
                </span>
              ) : null}
            </div>
            {mode === 'custom' ? (
              <>
                <ToggleSwitch
                  label="Save as preset"
                  checked={saveAsPreset}
                  onChange={setSaveAsPreset}
                  disabled={busy}
                />
                <span className="h-5 w-px bg-border-soft" aria-hidden />
              </>
            ) : null}
            <Button variant="ghost" onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => void onStart()}
              disabled={startDisabled}
              className={cn(busy && 'animate-border-pulse')}
            >
              {busy ? 'Starting…' : 'Start workflow'}
            </Button>
          </footer>
        </div>
      )}
    </StudioShell>
  );
};

type SectionHeaderProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly htmlFor?: string;
  readonly children?: ReactNode;
};

const SECTION_LABEL_CLS =
  'inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70';

const SectionHeader = ({ icon: Icon, label, htmlFor, children }: SectionHeaderProps) => (
  <div className="flex items-center gap-2">
    {htmlFor ? (
      <label htmlFor={htmlFor} className={SECTION_LABEL_CLS}>
        <Icon size={11} aria-hidden /> {label}
      </label>
    ) : (
      <span className={SECTION_LABEL_CLS}>
        <Icon size={11} aria-hidden /> {label}
      </span>
    )}
    {children ? (
      <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">{children}</div>
    ) : null}
  </div>
);

type TriggerButtonProps = {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
  readonly label: string;
};

const TriggerButton = ({ active, disabled, onClick, icon, label }: TriggerButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )}
  >
    {icon} {label}
  </button>
);

type ChainRun = { readonly run: { readonly id: WorkflowRunId }; readonly template: Workflow };

type ChainAfterSelectProps = {
  readonly runs: ReadonlyArray<ChainRun>;
  readonly value: WorkflowRunId | null;
  readonly disabled: boolean;
  readonly onChange: (id: WorkflowRunId) => void;
};

const ChainAfterSelect = ({ runs, value, disabled, onChange }: ChainAfterSelectProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);
  const selected = runs.find((r) => r.run.id === value) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label="run after which workflow"
        className={cn(
          'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <Link2 size={11} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="max-w-[12rem] truncate font-medium text-foreground">
          {selected?.template.name ?? 'Select workflow'}
        </span>
        <ChevronDown
          size={11}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={cn(POPUP_BASE, 'min-w-[12rem]', direction === 'up' ? POPUP_UP : POPUP_DOWN)}
        >
          {runs.map(({ run, template }) => {
            const active = run.id === value;
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  onChange(run.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span className="flex-1 truncate">{template.name}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

type ReadOnlyStepCardProps = {
  readonly ordinal: number;
  readonly kind: AgentKind;
  readonly name: string;
  readonly role: AgentRole;
  readonly model?: string;
  readonly effort?: EffortLevel;
  readonly promptPrefix: string;
};

const ReadOnlyStepCard = ({
  ordinal,
  kind,
  name,
  role,
  model,
  effort,
  promptPrefix,
}: ReadOnlyStepCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const pal = AGENT_KIND_PALETTE[kind];
  const instruction = (promptPrefix ?? '').trim();
  const expandable = instruction.length > 120;

  return (
    <li className="px-1 py-3 first:pt-1">
      <div className="flex items-center gap-2">
        <span className="w-3 shrink-0 text-right font-mono text-2xs text-muted-foreground/40">
          {ordinal + 1}
        </span>
        <AgentAvatar kind={kind} size="xs" />
        <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', pal.fg)}>{name}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-5 text-[10px] text-muted-foreground/70">
        <span>{ROLE_LABEL[role]}</span>
        <span aria-hidden>·</span>
        <span>{model ? modelLabel(model) : 'Auto'}</span>
        {effort ? (
          <>
            <span aria-hidden>·</span>
            <span>{EFFORT_LABEL[effort]}</span>
          </>
        ) : null}
      </div>
      {instruction ? (
        <>
          <p
            className={cn(
              'mt-1.5 pl-5 text-[11px] leading-relaxed text-muted-foreground',
              !expanded && 'line-clamp-3',
            )}
          >
            {instruction}
          </p>
          {expandable ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 pl-5 text-[10px] font-medium text-primary/80 transition-colors hover:text-primary"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 pl-5 text-[11px] italic leading-relaxed text-muted-foreground/50">
          Open-ended, no fixed instruction.
        </p>
      )}
    </li>
  );
};

type EditableStepCardProps = {
  readonly ordinal: number;
  readonly kind: AgentKind;
  readonly provider: ProviderId;
  readonly name: string;
  readonly promptPrefix: string;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly effortModel: string;
  readonly disabled: boolean;
  readonly onName: (v: string) => void;
  readonly onPrompt: (v: string) => void;
  readonly onModel: (v: string) => void;
  readonly onEffort: (v: EffortLevel) => void;
};

const EditableStepCard = ({
  ordinal,
  kind,
  provider,
  name,
  promptPrefix,
  model,
  effort,
  effortModel,
  disabled,
  onName,
  onPrompt,
  onModel,
  onEffort,
}: EditableStepCardProps) => {
  const pal = AGENT_KIND_PALETTE[kind];
  return (
    <li className="flex flex-col gap-2 px-1 py-3 first:pt-1">
      <div className="flex items-center gap-2">
        <span className="w-3 shrink-0 text-right font-mono text-2xs text-muted-foreground/40">
          {ordinal + 1}
        </span>
        <AgentAvatar kind={kind} size="xs" />
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="step name"
          disabled={disabled}
          className={cn('h-7 flex-1 text-xs font-medium', pal.fg)}
        />
      </div>
      <Textarea
        value={promptPrefix}
        onChange={(e) => onPrompt(e.target.value)}
        placeholder="role instructions for this step…"
        autoGrow
        minRows={2}
        maxRows={8}
        disabled={disabled}
        className="text-[11px] leading-relaxed"
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
            Model
          </span>
          <ModelSelect
            provider={provider}
            value={model}
            onChange={onModel}
            disabled={disabled}
            allowAuto
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
            Effort
          </span>
          <EffortSelect
            model={effortModel}
            value={effort}
            onChange={onEffort}
            disabled={disabled}
          />
        </div>
      </div>
    </li>
  );
};
