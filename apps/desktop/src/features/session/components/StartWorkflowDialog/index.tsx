import { useEffect, useState } from 'react';
import { Button, Dialog, cn } from '@goodboy/ui';
import { AlertTriangle, Check, Layers, Sparkles } from 'lucide-react';
import type { ProviderId, Session, Workflow, WorkflowId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { WorkflowPlanner } from '../../../workflows/components/WorkflowPlanner';
import { StepRowCompact } from '../../../workflows/components/StepRowCompact';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import type { AgentKind } from '../../agent-kind';
import { AGENT_KIND_DEFAULTS, inferAgentKindFromName, ROLE_TO_KIND } from '../../agent-kind';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  open: boolean;
  onClose: () => void;
  session: Session;
};

type Selection =
  | { readonly kind: 'preset'; readonly id: WorkflowId }
  | { readonly kind: 'custom' }
  | null;

function sortedSteps(template: Workflow): Workflow['steps'] {
  return [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
}

function stepKind(step: Workflow['steps'][number]): AgentKind {
  return step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
}

export function StartWorkflowDialog({ open, onClose, session }: Props) {
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const { showToast } = useToast();

  const [selection, setSelection] = useState<Selection>(null);
  const [customId, setCustomId] = useState<WorkflowId | ''>('');
  const [autoRun, setAutoRun] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const hasPresets = phaseTemplates.some((t) => t.isPreset !== false && !t.deletedAt);
    setSelection(hasPresets ? null : { kind: 'custom' });
    setCustomId('');
    setAutoRun(false);
    setSaveAsPreset(false);
    setBusy(false);
    setError(null);
  }, [open]);

  const providerId: ProviderId = session.providerPreference.defaultProvider;
  const presets = phaseTemplates.filter((t) => t.isPreset !== false && !t.deletedAt);

  const isCustom = selection?.kind === 'custom';
  const effectiveId: WorkflowId | '' =
    selection?.kind === 'preset' ? selection.id : isCustom ? customId : '';
  const selectedTemplate =
    effectiveId !== '' ? (phaseTemplates.find((t) => t.id === effectiveId) ?? null) : null;
  const canSpawn = effectiveId !== '' && !busy;

  const onSpawn = async () => {
    if (effectiveId === '') return;
    setError(null);
    setBusy(true);
    try {
      await attachWorkflowToSession(session.id, effectiveId, { autoRun });
      showToast('success', `workflow started: ${selectedTemplate?.name ?? 'workflow'}`);
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const customTemplate =
    isCustom && customId !== '' ? (phaseTemplates.find((t) => t.id === customId) ?? null) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start a workflow"
      description="Pick a saved preset, or describe the process you want. Skip and add it later."
      size="2xl"
      fixedHeightClass="h-[40rem]"
      panelWidthClass="w-72"
      panelClassName="min-h-0 bg-subtle/40"
      panel={
        <WorkflowRail
          presets={presets}
          selection={selection}
          customReady={customId !== ''}
          disabled={busy}
          onSelectPreset={(id) => setSelection({ kind: 'preset', id })}
          onSelectCustom={() => setSelection({ kind: 'custom' })}
        />
      }
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
      <DetailPane
        selection={selection}
        session={session}
        providerId={providerId}
        template={selection?.kind === 'preset' ? selectedTemplate : null}
        customTemplate={customTemplate}
        saveAsPreset={saveAsPreset}
        busy={busy}
        onToggleSaveAsPreset={setSaveAsPreset}
        onWorkflowReady={(id) => setCustomId(id)}
        onResetCustom={() => setCustomId('')}
      />
    </Dialog>
  );
}

function WorkflowRail({
  presets,
  selection,
  customReady,
  disabled,
  onSelectPreset,
  onSelectCustom,
}: {
  presets: ReadonlyArray<Workflow>;
  selection: Selection;
  customReady: boolean;
  disabled: boolean;
  onSelectPreset: (id: WorkflowId) => void;
  onSelectCustom: () => void;
}) {
  return (
    <>
      <CustomRailRow
        active={selection?.kind === 'custom'}
        ready={customReady}
        disabled={disabled}
        onClick={onSelectCustom}
      />
      <div className="mt-2 px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
        Presets ({presets.length})
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {presets.length === 0 ? (
          <p className="px-1.5 py-2 text-2xs leading-relaxed text-muted-foreground/70">
            No presets yet. Describe your own above.
          </p>
        ) : (
          presets.map((t) => (
            <PresetRailRow
              key={t.id}
              template={t}
              active={selection?.kind === 'preset' && selection.id === t.id}
              disabled={disabled}
              onClick={() => onSelectPreset(t.id)}
            />
          ))
        )}
      </div>
    </>
  );
}

function CustomRailRow({
  active,
  ready,
  disabled,
  onClick,
}: {
  active: boolean;
  ready: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border-soft bg-background hover:border-border hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md',
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <Sparkles size={13} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          Describe your own
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
            beta
          </span>
        </span>
        <span className="truncate text-[10px] text-muted-foreground/70">
          planner drafts the steps
        </span>
      </span>
      {ready ? <Check size={13} className="shrink-0 text-success" aria-hidden /> : null}
    </button>
  );
}

function PresetRailRow({
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
  const steps = sortedSteps(template);
  const kinds = steps.map(stepKind);
  const shown = kinds.slice(0, 5);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border-soft bg-background hover:border-border hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {template.name}
        </span>
        {active ? (
          <Check size={13} className="shrink-0 text-primary" aria-hidden />
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground/50">{steps.length}</span>
        )}
      </span>
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
}

function DetailPane({
  selection,
  session,
  providerId,
  template,
  customTemplate,
  saveAsPreset,
  busy,
  onToggleSaveAsPreset,
  onWorkflowReady,
  onResetCustom,
}: {
  selection: Selection;
  session: Session;
  providerId: ProviderId;
  template: Workflow | null;
  customTemplate: Workflow | null;
  saveAsPreset: boolean;
  busy: boolean;
  onToggleSaveAsPreset: (value: boolean) => void;
  onWorkflowReady: (id: WorkflowId) => void;
  onResetCustom: () => void;
}) {
  if (selection === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <Layers size={22} className="text-muted-foreground/30" aria-hidden />
        <p className="text-sm font-medium text-foreground">Pick a workflow</p>
        <p className="max-w-[19rem] text-xs leading-relaxed text-muted-foreground">
          Choose a preset on the left, or describe the process you want and let the planner draft
          it.
        </p>
      </div>
    );
  }

  if (selection.kind === 'preset') {
    return template ? <PresetPreview template={template} /> : null;
  }

  if (customTemplate) {
    return <CustomReady template={customTemplate} onReset={onResetCustom} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2">
        <span className="shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground/60">
          for
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{session.goal}</span>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-2xs text-muted-foreground">
        <input
          type="checkbox"
          checked={saveAsPreset}
          onChange={(e) => onToggleSaveAsPreset(e.target.checked)}
          className="accent-primary"
          disabled={busy}
        />
        Save as preset to reuse it on other sessions.
      </label>
      <WorkflowPlanner
        workspaceId={session.workspaceId}
        providerId={providerId}
        initialProcess=""
        saveAsPreset={saveAsPreset}
        onWorkflowReady={onWorkflowReady}
      />
    </div>
  );
}

function PresetPreview({ template }: { template: Workflow }) {
  const steps = sortedSteps(template);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{template.name}</div>
        {template.description ? (
          <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        ) : null}
      </div>
      <StepLadder steps={steps} />
      <p className="text-2xs text-muted-foreground/60">
        {steps.length} step{steps.length === 1 ? '' : 's'}, each spawns its own agent in order.
      </p>
    </div>
  );
}

function CustomReady({ template, onReset }: { template: Workflow; onReset: () => void }) {
  const steps = sortedSteps(template);
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
      <StepLadder steps={steps} />
    </div>
  );
}

function StepLadder({ steps }: { steps: Workflow['steps'] }) {
  return (
    <div className="rounded-lg border border-border-soft bg-subtle px-3.5 py-3">
      <ol className="flex flex-col gap-1.5">
        {steps.map((step, i) => {
          const kind = stepKind(step);
          return (
            <li key={step.id}>
              <StepRowCompact
                index={i}
                kind={kind}
                name={step.name}
                model={step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model}
                verbosity={step.verbosity ?? 'normal'}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
