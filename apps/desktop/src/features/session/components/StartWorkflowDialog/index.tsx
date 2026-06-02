import { useEffect, useState } from 'react';
import { Button, Dialog, cn } from '@goodboy/ui';
import { Check, Layers, Sparkles, AlertTriangle } from 'lucide-react';
import type { ProviderId, Session, Workflow, WorkflowId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { WorkflowPlanner } from '../../../workflows/components/WorkflowPlanner';
import { shortModel } from '../../agent-row-format';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
  ROLE_TO_KIND,
} from '../../agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  session: Session;
}

type Mode = 'preset' | 'custom';

export function StartWorkflowDialog({ open, onClose, session }: Props) {
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('preset');
  const [presetId, setPresetId] = useState<WorkflowId | ''>('');
  const [customId, setCustomId] = useState<WorkflowId | ''>('');
  const [autoRun, setAutoRun] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('preset');
    setPresetId('');
    setCustomId('');
    setAutoRun(false);
    setSaveAsPreset(false);
    setBusy(false);
    setError(null);
  }, [open]);

  const providerId: ProviderId = session.providerPreference.defaultProvider;

  // Only reusable, non-deleted presets are pickable. A deleted-but-attached
  // workflow (kept in phaseTemplates for in-session resolution) or a one-off
  // custom workflow (isPreset === false) must not appear here.
  const presets = phaseTemplates.filter((t) => t.isPreset !== false && !t.deletedAt);

  const selectedId = mode === 'preset' ? presetId : customId;
  const selectedTemplate =
    selectedId !== '' ? (phaseTemplates.find((t) => t.id === selectedId) ?? null) : null;
  const canSpawn = selectedId !== '' && !busy;

  const onSpawn = async () => {
    if (selectedId === '') return;
    setError(null);
    setBusy(true);
    try {
      await attachWorkflowToSession(session.id, selectedId as WorkflowId, { autoRun });
      showToast('success', `workflow started: ${selectedTemplate?.name ?? 'workflow'}`);
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start a workflow"
      description="Pick a saved preset, or design a custom one. You can skip and add it later."
      size="xl"
      footer={
        <div className="flex w-full items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              className="accent-primary"
              disabled={busy}
            />
            <span className="flex items-center gap-1.5">
              Auto-run
              <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                beta
              </span>
            </span>
          </label>
          {/* Only meaningful while composing a custom workflow; sits by Auto-run
              instead of taking a row in the body. */}
          {mode === 'custom' && customId === '' ? (
            <label
              className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
              title="Keep this workflow reusable. Otherwise it runs once for this session."
            >
              <input
                type="checkbox"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="accent-primary"
                disabled={busy}
              />
              Save as preset
            </label>
          ) : null}
          <div className="flex-1">
            {error ? (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={12} aria-hidden />
                {error}
              </span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Skip for now
          </Button>
          <Button onClick={() => void onSpawn()} disabled={!canSpawn}>
            Start workflow
          </Button>
        </div>
      }
    >
      {/* Tabs + caption stay pinned; only the content below scrolls, so the
          mode switch never leaves the viewport. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5">
        <ModeTabs mode={mode} onSelect={setMode} />
        <p className="shrink-0 px-0.5 text-2xs leading-relaxed text-muted-foreground">
          {mode === 'preset'
            ? 'Saved pipelines. Each step spawns its own agent, in order.'
            : 'Describe a goal and the planner drafts the steps. Tune models per step, then run.'}
        </p>

        {/* All three panes stay mounted (toggled with `hidden`) so switching
            Preset<->Custom never unmounts the planner: an in-flight plan keeps
            generating and a generated plan survives the round-trip. */}
        <div className="-mx-0.5 min-h-0 flex-1 overflow-y-auto px-0.5">
          <div className={mode === 'preset' ? undefined : 'hidden'}>
            <PresetPicker
              templates={presets}
              value={presetId}
              onChange={setPresetId}
              disabled={busy}
            />
          </div>
          <div className={mode === 'custom' && customId === '' ? undefined : 'hidden'}>
            <WorkflowPlanner
              workspaceId={session.workspaceId}
              providerId={providerId}
              initialTheme={session.goal}
              saveAsPreset={saveAsPreset}
              onWorkflowReady={(workflowId) => setCustomId(workflowId)}
            />
          </div>
          <div className={mode === 'custom' && customId !== '' ? undefined : 'hidden'}>
            <CustomReady
              template={phaseTemplates.find((t) => t.id === customId) ?? null}
              onReset={() => setCustomId('')}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Mode switch — a compact segmented control rather than two large cards, so it
// reads at a glance and leaves the room for the actual workflow content.
// ----------------------------------------------------------------------------
function ModeTabs({ mode, onSelect }: { mode: Mode; onSelect: (m: Mode) => void }) {
  return (
    <div className="flex shrink-0 gap-1 rounded-lg border border-border-soft bg-subtle p-1">
      <ModeTab
        active={mode === 'preset'}
        onClick={() => onSelect('preset')}
        icon={<Layers size={14} aria-hidden />}
        label="Preset"
      />
      <ModeTab
        active={mode === 'custom'}
        onClick={() => onSelect('custom')}
        icon={<Sparkles size={14} aria-hidden />}
        label="Custom"
        beta
      />
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  beta,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  beta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border-soft'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className={active ? 'text-primary' : undefined}>{icon}</span>
      {label}
      {beta ? (
        <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
          beta
        </span>
      ) : null}
    </button>
  );
}

function PresetPicker({
  templates,
  value,
  onChange,
  disabled,
}: {
  templates: ReadonlyArray<Workflow>;
  value: WorkflowId | '';
  onChange: (id: WorkflowId | '') => void;
  disabled: boolean;
}) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-soft bg-subtle/60 px-6 py-10 text-center">
        <Layers size={22} className="text-muted-foreground/30" aria-hidden />
        <p className="text-sm font-medium text-foreground">No workflow presets yet</p>
        <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
          Switch to <span className="font-medium text-foreground">Custom</span> to design your first
          workflow with the planner.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {templates.map((t) => (
        <li key={t.id}>
          <PresetOption
            template={t}
            active={value === t.id}
            disabled={disabled}
            onClick={() => onChange(value === t.id ? '' : t.id)}
          />
        </li>
      ))}
    </ul>
  );
}

// One selectable preset, rendered with the same vocabulary as the Workflow
// Studio preset card: ordinal · avatar · role-coloured name · model·verbosity.
function PresetOption({
  template,
  active,
  disabled,
  onClick,
}: {
  template: Workflow;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg border px-3.5 py-3 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 truncate text-sm font-semibold text-foreground">
          {template.name}
        </span>
        {template.description ? (
          <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground/70">
            {template.description}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="shrink-0 text-2xs text-muted-foreground/50">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
        {active ? <Check size={14} className="shrink-0 text-primary" aria-hidden /> : null}
      </div>
      {steps.length > 0 ? (
        <ol className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} />
          ))}
        </ol>
      ) : null}
    </button>
  );
}

// Shared step line used by preset cards and the custom-ready summary.
function StepRow({ step, index }: { step: Workflow['steps'][number]; index: number }) {
  const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
  const model = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
  const verbosity = step.verbosity ?? 'normal';
  return (
    <li className="flex items-center gap-2">
      <span className="w-3 shrink-0 text-right font-mono text-2xs text-muted-foreground/40">
        {index + 1}
      </span>
      <AgentAvatar kind={kind} size="xs" />
      <span className={cn('truncate text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
        {step.name}
      </span>
      <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground/50">
        {shortModel(model)} · {verbosity}
      </span>
    </li>
  );
}

function CustomReady({ template, onReset }: { template: Workflow | null; onReset: () => void }) {
  if (!template) return null;
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
          <Check size={10} className="text-success" aria-hidden />
        </span>
        <span className="text-xs font-medium text-foreground">Workflow ready</span>
        <span className="text-2xs text-muted-foreground/60">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        >
          <Sparkles size={10} aria-hidden /> Re-design
        </button>
      </div>
      <div className="rounded-lg border border-border-soft bg-subtle px-3.5 py-3">
        <ol className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <StepRow key={step.id} step={step} index={i} />
          ))}
        </ol>
      </div>
    </div>
  );
}
