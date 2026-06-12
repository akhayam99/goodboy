import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertTriangle,
  Check,
  Hand,
  Layers,
  Link2,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Undo2,
  Wand2,
  X,
} from 'lucide-react';
import { Button, Divider, Input, Textarea, cn } from '@goodboy/ui';
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
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
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
  const setWorkflowDraft = useAppStore((s) => s.setWorkflowDraft);
  const clearWorkflowDraft = useAppStore((s) => s.clearWorkflowDraft);
  const { showToast } = useToast();

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

  const providerId: ProviderId = session.providerPreference.defaultProvider;
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
  const sessionGoal = (session.goal ?? '').trim();
  const selectedPreset = presets.find((t) => t.id === selectedPresetId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !blocked) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

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
    <div className="flex h-full w-full flex-col bg-background motion-safe:animate-studio-in">
      <header className="flex shrink-0 items-center gap-3 px-6 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles size={16} className="text-primary" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-sm font-semibold text-foreground">Start a workflow</h1>
          <span className="truncate text-2xs text-muted-foreground">for: {session.goal}</span>
        </div>
        <div className="flex-1" />
        {!draftEmpty ? (
          <button
            type="button"
            onClick={resetDraft}
            disabled={blocked}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors',
              'hover:border-border hover:bg-muted/50 hover:text-foreground',
              blocked && 'cursor-not-allowed opacity-50',
            )}
            aria-label="reset workflow draft"
          >
            <RotateCcw size={13} aria-hidden /> Reset draft
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleClose}
          disabled={blocked}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors',
            'hover:border-border hover:bg-muted/50 hover:text-foreground',
            blocked && 'cursor-not-allowed opacity-50',
          )}
          aria-label="cancel workflow builder"
        >
          <X size={13} aria-hidden /> Cancel
        </button>
      </header>
      <Divider />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="workflow-goal"
                  className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70"
                >
                  <Target size={11} aria-hidden /> Goal
                </label>
                <div className="flex-1" />
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
                  className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {polishing ? (
                    <Loader2 size={10} className="animate-spin" aria-hidden />
                  ) : (
                    <Wand2 size={10} aria-hidden />
                  )}
                  Polish
                </button>
                {sessionGoal.length > 0 ? (
                  <button
                    type="button"
                    onClick={onUseSessionGoal}
                    disabled={blocked || polishing || goalText === sessionGoal}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-2xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use session goal
                  </button>
                ) : null}
              </div>
              <Textarea
                id="workflow-goal"
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="what should this workflow accomplish? same as the session, or a specific sub-objective (e.g. just the auth module)…"
                autoGrow
                minRows={2}
                maxRows={4}
                disabled={busy || polishing}
                className="resize-none rounded-lg bg-subtle/80 px-4 py-3 text-sm ring-1 ring-border-soft focus-visible:ring-foreground/15"
              />
              <p className="px-1 text-2xs leading-relaxed text-muted-foreground/60">
                Every step of the workflow works toward this goal.
              </p>
            </div>

            <div className="flex w-fit items-center gap-0.5 rounded-lg bg-subtle/80 p-0.5 ring-1 ring-border-soft">
              <button
                type="button"
                onClick={() => setMode('preset')}
                disabled={blocked}
                aria-pressed={mode === 'preset'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  mode === 'preset'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ListChecks size={12} aria-hidden /> Preset
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                disabled={blocked}
                aria-pressed={mode === 'custom'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  mode === 'custom'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sparkles size={12} aria-hidden /> Custom
                <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                  beta
                </span>
              </button>
            </div>

            {mode === 'preset' ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Pick the preset to run toward this goal. Its steps show on the right.
                </p>
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
                  <div
                    className="flex flex-col divide-y divide-border-soft/50"
                    role="radiogroup"
                    aria-label="presets"
                  >
                    {presets.map((t) => {
                      const steps = sortedSteps(t);
                      const kinds = steps.map(templateStepKind);
                      const shown = kinds.slice(0, 5);
                      const selected = t.id === selectedPresetId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setSelectedPresetId(t.id)}
                          disabled={busy}
                          className={cn(
                            'flex flex-col gap-1.5 px-2.5 py-2.5 text-left transition-colors first:rounded-t-md last:rounded-b-md',
                            selected ? 'bg-primary/5' : 'hover:bg-muted/40',
                            busy && 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {t.name}
                            </span>
                            {selected ? (
                              <Check size={13} className="shrink-0 text-primary" aria-hidden />
                            ) : (
                              <span className="shrink-0 text-[10px] text-muted-foreground/50">
                                {steps.length} step{steps.length === 1 ? '' : 's'}
                              </span>
                            )}
                          </span>
                          {t.description || t.goal ? (
                            <span className="truncate text-[10px] leading-snug text-muted-foreground/70">
                              {t.description || t.goal}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1">
                            {shown.map((k, i) => (
                              <AgentAvatar key={`${k}-${i}`} kind={k} size="xs" />
                            ))}
                            {kinds.length > shown.length ? (
                              <span className="text-[10px] text-muted-foreground/40">
                                +{kinds.length - shown.length}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Describe the flow you would like: should it commit or not, open a PR, get reviewed
                  first. The planner drafts the steps, each one spawns its own agent in order, and
                  you can tune the model per step before starting.
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
                      minRows={5}
                      maxRows={10}
                      className="min-h-24 resize-none border-0 bg-transparent px-4 pt-3 pb-12 text-sm shadow-none focus-visible:ring-0"
                    />
                    <div className="absolute bottom-2.5 right-2.5">
                      <Button
                        size="sm"
                        onClick={() => void onPlan()}
                        disabled={blocked || processText.trim().length === 0}
                        className="min-w-[6.5rem]"
                      >
                        {planning ? (
                          <Loader2 size={15} className="animate-spin" aria-label="planning" />
                        ) : plan ? (
                          'Re-plan'
                        ) : (
                          'Generate plan'
                        )}
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

            <div className="flex flex-col gap-1.5">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
                When to start
              </span>
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
                <select
                  value={resolvedChainId ?? ''}
                  onChange={(e) => setChainAfterId(e.target.value as WorkflowRunId)}
                  disabled={blocked}
                  aria-label="run after which workflow"
                  className="w-fit rounded-md bg-subtle/80 px-2 py-1 text-xs text-foreground ring-1 ring-border-soft focus-visible:ring-foreground/15"
                >
                  {activeRuns.map(({ run, template }) => (
                    <option key={run.id} value={run.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              ) : null}
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
            </div>
          </div>
        </div>

        <div className="hidden w-96 shrink-0 flex-col overflow-y-auto border-l border-border-soft bg-subtle/40 px-4 py-5 lg:flex">
          {mode === 'preset' ? (
            selectedPreset ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
                    <Check size={10} className="text-success" aria-hidden />
                  </span>
                  <span className="text-xs font-medium text-foreground">Preset ready</span>
                  <span className="text-2xs text-muted-foreground/60">
                    {selectedPreset.steps.length} step{selectedPreset.steps.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="truncate text-xs font-semibold text-foreground">
                  {selectedPreset.name}
                </div>
                <ol className="flex flex-col divide-y divide-border-soft/50">
                  {sortedSteps(selectedPreset).map((s, i) => (
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
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <Layers size={22} className="text-muted-foreground/30" aria-hidden />
                <p className="text-xs font-medium text-foreground">Step preview</p>
                <p className="max-w-[15rem] text-2xs leading-relaxed text-muted-foreground">
                  Pick a preset and its ordered steps show here.
                </p>
              </div>
            )
          ) : plan ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
                  <Check size={10} className="text-success" aria-hidden />
                </span>
                <span className="text-xs font-medium text-foreground">Workflow ready</span>
                <span className="text-2xs text-muted-foreground/60">
                  {plan.steps.length} step{plan.steps.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={onRedesign}
                  disabled={blocked}
                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles size={10} aria-hidden /> Re-design
                </button>
              </div>
              <div className="truncate text-xs font-semibold text-foreground">
                {plan.workflowName}
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
            </div>
          ) : planning ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Loader2 size={22} className="animate-spin text-muted-foreground/40" aria-hidden />
              <p className="text-xs font-medium text-foreground">Drafting plan</p>
              <p className="max-w-[15rem] text-2xs leading-relaxed text-muted-foreground">
                The planner is breaking your process into ordered steps.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Layers size={22} className="text-muted-foreground/30" aria-hidden />
              <p className="text-xs font-medium text-foreground">Step preview</p>
              <p className="max-w-[15rem] text-2xs leading-relaxed text-muted-foreground">
                Once the planner drafts a workflow, the ordered steps show here with a model pick
                per step.
              </p>
            </div>
          )}
        </div>
      </div>
      <Divider />

      <footer className="flex shrink-0 items-center gap-3 px-6 py-3">
        <div className="flex-1">
          {error ? (
            <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle size={12} aria-hidden />
              {error}
            </span>
          ) : null}
        </div>
        {mode === 'custom' ? (
          <ToggleSwitch
            label="Save as preset"
            checked={saveAsPreset}
            onChange={setSaveAsPreset}
            disabled={busy}
          />
        ) : null}
        <ToggleSwitch
          label="Auto-run"
          beta
          checked={autoRun}
          onChange={setAutoRun}
          disabled={busy}
        />
        <span className="h-5 w-px bg-border-soft" aria-hidden />
        <Button variant="ghost" onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void onStart()} disabled={startDisabled}>
          {busy ? (
            <Loader2 size={15} className="animate-spin" aria-label="starting" />
          ) : (
            'Start workflow'
          )}
        </Button>
      </footer>
    </div>
  );
};

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
