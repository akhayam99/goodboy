import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  Check,
  DollarSign,
  GitBranch,
  Layers,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowId,
  ProviderId,
  TaskId,
  TaskProviderPreference,
  WorkspaceId,
} from '@kay-am/types';
import { shortModel } from '../agentRowFormat';
import { PROVIDER_LABEL_LOWER } from '../providers';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../settings';
import { EMPTY_ARRAY, useAppStore } from '../store';
import { PlannerWidget } from './PlannerWidget';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybe = err as { message?: unknown };
    if (typeof maybe.message === 'string') return maybe.message;
    try {
      return JSON.stringify(err);
    } catch {
      return 'unknown error';
    }
  }
  return String(err);
}

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

type WorkflowMode = 'one-off' | 'preset' | 'custom';

const WORKFLOW_MODES: ReadonlyArray<{
  id: WorkflowMode;
  label: string;
  hint: string;
}> = [
  {
    id: 'one-off',
    label: 'one-off',
    hint: 'single chat — spawn agents manually when you need them.',
  },
  {
    id: 'preset',
    label: 'preset',
    hint: 'pick a saved workflow blueprint. each step pre-spawns its own agent.',
  },
  {
    id: 'custom',
    label: 'custom',
    hint: 'design a fresh workflow with the planner agent, then run it.',
  },
];

function pickDefaultProvider(connectedIds: ReadonlySet<ProviderId>): ProviderId {
  for (const id of PROVIDER_ORDER) {
    if (connectedIds.has(id)) return id;
  }
  return 'anthropic';
}

export function NewSessionDialog({
  open,
  onClose,
  workspaceId,
  onOpenSettings,
}: NewSessionDialogProps) {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const providers = useAppStore((s) => s.providers);
  const settingKey = settingBranchPrefix(workspaceId);
  const storedPrefix = useAppStore((s) => s.settings[settingKey]);
  const phaseTemplates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);
  const [goal, setGoal] = useState('');
  const [prefix, setPrefix] = useState(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
  const [softCapRaw, setSoftCapRaw] = useState('');
  const [selectedPhaseTemplateId, setSelectedPhaseTemplateId] = useState<WorkflowId | ''>('');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('one-off');
  const [autoRun, setAutoRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => {
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    return pickDefaultProvider(ids);
  });

  useEffect(() => {
    if (!open) return;
    // Open should always present a virgin form: reset every field, not just
    // prefix/provider. Otherwise stale goal/template/budget/planner state from
    // a previous (cancelled) attempt — or from a previous workspace — leaks in.
    setGoal('');
    setSoftCapRaw('');
    setSelectedPhaseTemplateId('');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setError(null);
    void loadSetting(settingKey).then((value) => {
      setPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    setSelectedProvider(pickDefaultProvider(ids));
  }, [open, settingKey, loadSetting, providers, workspaceId]);

  const reset = () => {
    setGoal('');
    setPrefix(storedPrefix ?? DEFAULT_BRANCH_PREFIX);
    setSoftCapRaw('');
    setSelectedPhaseTemplateId('');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const providerPreference: TaskProviderPreference = {
        defaultProvider: selectedProvider,
        allowTurnOverride: true,
      };
      const hasWorkflow = selectedPhaseTemplateId !== '';
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: prefix,
        providerPreference,
        ...(hasWorkflow ? { workflowId: selectedPhaseTemplateId as WorkflowId } : {}),
        ...(hasWorkflow && autoRun ? { autoRun: true } : {}),
      });
      const parsedCap = parseFloat(softCapRaw);
      if (softCapRaw.trim().length > 0 && !isNaN(parsedCap) && parsedCap > 0) {
        await setSessionBudget(session.id as TaskId, parsedCap);
      }
      reset();
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const connectedProviderIds = new Set(
    providers.filter((p) => p.connection === 'connected').map((p) => p.id),
  );

  type SectionId = 'goal' | 'branch' | 'budget' | 'workflow' | 'provider';
  const [activeSection, setActiveSection] = useState<SectionId>('goal');

  const goalReady = goal.trim().length > 0;
  const budgetReady = softCapRaw.trim().length > 0;
  const workflowReady = selectedPhaseTemplateId !== '';
  const providerReady = connectedProviderIds.has(selectedProvider);

  const sections: ReadonlyArray<{
    id: SectionId;
    label: string;
    icon: ReactNode;
    ready: boolean;
    required: boolean;
  }> = [
    {
      id: 'goal',
      label: 'Goal',
      icon: <Target size={13} aria-hidden />,
      ready: goalReady,
      required: true,
    },
    {
      id: 'branch',
      label: 'Branch',
      icon: <GitBranch size={13} aria-hidden />,
      ready: prefix.trim().length > 0,
      required: false,
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: <DollarSign size={13} aria-hidden />,
      ready: budgetReady,
      required: false,
    },
    {
      id: 'workflow',
      label: 'Workflow',
      icon: <Layers size={13} aria-hidden />,
      ready: workflowReady,
      required: false,
    },
    {
      id: 'provider',
      label: 'Provider',
      icon: <Zap size={13} aria-hidden />,
      ready: providerReady,
      required: true,
    },
  ];

  const onWorkflowModeChange = (next: WorkflowMode) => {
    setWorkflowMode(next);
    if (next === 'one-off') {
      setSelectedPhaseTemplateId('');
      setAutoRun(false);
    } else if (next === 'preset' || next === 'custom') {
      setSelectedPhaseTemplateId('');
    }
  };

  const missingRequired = sections.filter((s) => s.required && !s.ready);
  const disabledReason =
    missingRequired.length > 0
      ? `complete: ${missingRequired.map((s) => s.label.toLowerCase()).join(', ')}`
      : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New session"
      description="Creates a worktree on a fresh branch from the workspace root."
      size="xl"
      fixedHeightClass="h-[640px]"
      footer={
        <>
          {error ? (
            <span className="mr-auto text-xs text-danger">{error}</span>
          ) : disabledReason ? (
            <span className="mr-auto inline-flex items-center gap-1 text-xs text-warning">
              <AlertTriangle size={12} aria-hidden />
              {disabledReason}
            </span>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={!goalReady || !providerReady || busy}
            title={disabledReason}
          >
            {busy ? 'creating…' : 'create session'}
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              title={s.required && !s.ready ? `${s.label.toLowerCase()} is required` : undefined}
              className={cn(
                'relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                activeSection === s.id
                  ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {s.icon}
              <span className="flex-1">
                {s.label}
                {s.required ? (
                  <span aria-hidden className="ml-0.5 text-warning">
                    *
                  </span>
                ) : null}
              </span>
              {s.ready ? (
                <Check size={11} className="text-success" aria-label="filled" />
              ) : s.required ? (
                <AlertTriangle
                  size={11}
                  className="text-warning"
                  aria-label={`${s.label.toLowerCase()} required`}
                />
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto pl-4">
          {activeSection === 'goal' ? (
            <Field label="goal" hint="what the session should accomplish.">
              <Textarea
                value={goal}
                placeholder="refactor auth domain"
                onChange={(e) => setGoal(e.target.value)}
                autoGrow
                minRows={4}
                maxRows={16}
                autoFocus
              />
            </Field>
          ) : null}

          {activeSection === 'branch' ? (
            <Field label="branch prefix" hint="branch name will be `<prefix>/<slug>`.">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="kay" />
            </Field>
          ) : null}

          {activeSection === 'budget' ? (
            <Field
              label="soft cap (usd)"
              hint="optional spend limit. session is flagged when exceeded."
            >
              <Input
                value={softCapRaw}
                onChange={(e) => setSoftCapRaw(e.target.value)}
                placeholder="e.g. 5.00"
                type="number"
                min="0"
                step="0.01"
              />
            </Field>
          ) : null}

          {activeSection === 'workflow' ? (
            <Field label="workflow (optional)" hint={workflowModeHint(workflowMode)}>
              <WorkflowModeSegmented mode={workflowMode} onChange={onWorkflowModeChange} />

              {workflowMode === 'one-off' ? (
                <div className="mt-3 rounded-md border border-dashed border-border-soft bg-subtle px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                  no workflow attached. you can spawn agents on demand from the chat sidebar.
                </div>
              ) : null}

              {workflowMode === 'preset' ? (
                <div className="mt-3 flex flex-col gap-3">
                  {phaseTemplates.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border-soft bg-subtle px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                      no presets yet — switch to <span className="font-medium">custom</span> and
                      design one with the planner.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {phaseTemplates.map((t) => (
                        <WorkflowChip
                          key={t.id}
                          label={`${t.name.toLowerCase()}${t.steps.length > 0 ? ` · ${t.steps.length}` : ''}`}
                          active={selectedPhaseTemplateId === t.id}
                          onClick={() => setSelectedPhaseTemplateId(t.id)}
                          title={t.description || undefined}
                        />
                      ))}
                    </div>
                  )}
                  {selectedPhaseTemplateId !== '' ? (
                    <WorkflowPreview
                      template={
                        phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              {workflowMode === 'custom' ? (
                <div className="mt-3 flex flex-col gap-3">
                  {selectedPhaseTemplateId !== '' ? (
                    <>
                      <WorkflowPreview
                        template={
                          phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedPhaseTemplateId('')}
                        className="flex items-center gap-1 self-start text-2xs text-muted-foreground underline hover:text-foreground"
                      >
                        <Sparkles size={10} aria-hidden /> re-design with planner
                      </button>
                    </>
                  ) : (
                    <div className="rounded-md border border-border-soft bg-subtle px-3 py-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sparkles size={12} aria-hidden /> design with planner
                      </div>
                      <PlannerWidget
                        workspaceId={workspaceId}
                        providerId={selectedProvider}
                        initialTheme={goal}
                        onWorkflowReady={(workflowId) => {
                          setSelectedPhaseTemplateId(workflowId);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {workflowMode !== 'one-off' && selectedPhaseTemplateId !== '' ? (
                <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">run autonomously</span>
                    <span className="text-muted-foreground">
                      auto-spawn each step on completion. pauses on error or budget exceed.
                    </span>
                  </span>
                </label>
              ) : null}
            </Field>
          ) : null}

          {activeSection === 'provider' ? (
            <Field label="provider">
              <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border">
                {PROVIDER_ORDER.map((id) => {
                  const connected = connectedProviderIds.has(id);
                  const disabled = !connected;
                  const selected = selectedProvider === id;
                  return (
                    <li
                      key={id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm motion-safe:transition-colors',
                        disabled ? 'opacity-50' : 'hover:bg-muted/40',
                        selected && !disabled ? 'bg-muted/60' : '',
                      )}
                    >
                      <input
                        type="radio"
                        name="provider"
                        id={`provider-${id}`}
                        value={id}
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setSelectedProvider(id)}
                        className="accent-primary"
                      />
                      <label
                        htmlFor={`provider-${id}`}
                        className={cn(
                          'flex flex-1 items-center justify-between',
                          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                        )}
                      >
                        <span className="font-medium">{PROVIDER_LABEL_LOWER[id]}</span>
                        {!connected && (
                          <button
                            type="button"
                            className="text-xs text-primary underline hover:opacity-80"
                            onClick={() => {
                              onClose();
                              window.dispatchEvent(
                                new CustomEvent('kayam:open-settings', {
                                  detail: { section: 'providers' },
                                }),
                              );
                            }}
                          >
                            connect in settings
                          </button>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Field>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function WorkflowPreview({ template }: { template: Workflow | null }) {
  if (!template) return null;
  if (template.steps.length === 0) {
    return (
      <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground">
        this workflow has no steps yet — add some via the planner above.
      </p>
    );
  }
  const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-subtle p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          will spawn {template.steps.length} agent
          {template.steps.length === 1 ? '' : 's'}
        </span>
        {template.description ? (
          <span className="truncate text-2xs text-muted-foreground/70">{template.description}</span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-1">
        {sortedSteps.map((step, i) => {
          const model = step.modelOverride ? shortModel(step.modelOverride) : null;
          const effort = step.effort ?? null;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2 rounded-md bg-background px-2 py-1 text-xs"
            >
              <span className="font-mono text-2xs text-muted-foreground">{i + 1}.</span>
              <span className="flex-1 truncate font-medium text-foreground">{step.name}</span>
              {model || effort ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {[model, effort].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-2xs text-muted-foreground/70">
        each agent runs in its own chat thread. you decide which one gets the next turn.
      </p>
    </div>
  );
}

function WorkflowChip({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs motion-safe:transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'bg-subtle text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function WorkflowModeSegmented({
  mode,
  onChange,
}: {
  mode: WorkflowMode;
  onChange: (next: WorkflowMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="workflow mode"
      className="inline-flex rounded-md border border-border bg-subtle p-0.5"
    >
      {WORKFLOW_MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function workflowModeHint(mode: WorkflowMode): string {
  return WORKFLOW_MODES.find((m) => m.id === mode)?.hint ?? '';
}
