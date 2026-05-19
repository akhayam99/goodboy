import { useEffect, useState } from 'react';
import { Button, Dialog, cn } from '@kay-am/ui';
import { Check, Layers, Sparkles, AlertTriangle } from 'lucide-react';
import type { ProviderId, Session, Workflow, WorkflowId } from '@kay-am/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PlannerWidget } from '../../../plans/components/PlannerWidget';
import { shortModel } from '../../agent-row-format';
import { AGENT_KIND_PALETTE, inferAgentKindFromName } from '../../agent-kind';
import { formatError } from '../../../../shared/lib/errors';
import { useToast } from '../../../../app/components/Toast';

interface StartWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  session: Session;
}

type Mode = 'preset' | 'custom';

export function StartWorkflowDialog({ open, onClose, session }: StartWorkflowDialogProps) {
  const phaseTemplates = useAppStore(
    (s) => s.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const { showToast } = useToast();

  const [mode, setMode] = useState<Mode>('preset');
  const [presetId, setPresetId] = useState<WorkflowId | ''>('');
  const [customId, setCustomId] = useState<WorkflowId | ''>('');
  const [autoRun, setAutoRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('preset');
    setPresetId('');
    setCustomId('');
    setAutoRun(false);
    setBusy(false);
    setError(null);
  }, [open]);

  const providerId: ProviderId = session.providerPreference.defaultProvider;

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
      description="Pick a saved preset or design a fresh workflow with the planner."
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
          <div className="flex-1">
            {error ? (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={12} aria-hidden />
                {error}
              </span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onSpawn()} disabled={!canSpawn}>
            Spawn workflow
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === 'preset'}
            onClick={() => setMode('preset')}
            icon={<Layers size={16} className="text-primary" aria-hidden />}
            title="Preset"
            description="Pick from saved workflows. Each step spawns its own agent."
          />
          <ModeCard
            active={mode === 'custom'}
            onClick={() => setMode('custom')}
            icon={<Sparkles size={16} className="text-primary" aria-hidden />}
            title="Custom"
            description="Design a new workflow with the planner, then run it."
            beta
          />
        </div>

        <div>
          {mode === 'preset' ? (
            <PresetPicker
              templates={phaseTemplates}
              value={presetId}
              onChange={setPresetId}
              disabled={busy}
            />
          ) : customId !== '' ? (
            <CustomReady
              template={phaseTemplates.find((t) => t.id === customId) ?? null}
              onReset={() => setCustomId('')}
            />
          ) : (
            <CustomIntro>
              <PlannerWidget
                workspaceId={session.workspaceId}
                providerId={providerId}
                initialTheme={session.goal}
                onWorkflowReady={(workflowId) => setCustomId(workflowId)}
              />
            </CustomIntro>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
  beta,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  beta?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
      )}
    >
      <div className="flex w-full items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {beta ? (
          <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
            beta
          </span>
        ) : null}
        {active ? <Check size={13} className="ml-auto text-primary" aria-hidden /> : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}

function CustomIntro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {children}
      <div className="grid grid-cols-3 gap-2">
        <PlannerHint
          tone="primary"
          eyebrow="Step 1"
          title="Describe the goal"
          body="Paste a goal or refine the prefilled one."
        />
        <PlannerHint
          tone="info"
          eyebrow="Step 2"
          title="Generate plan"
          body="Cheap-tier model drafts ordered steps with roles."
        />
        <PlannerHint
          tone="success"
          eyebrow="Step 3"
          title="Tweak & spawn"
          body="Override models per step, then spawn the workflow."
        />
      </div>
    </div>
  );
}

const HINT_TONE_BG: Record<'primary' | 'info' | 'success', string> = {
  primary: 'bg-primary/10',
  info: 'bg-info/10',
  success: 'bg-success/10',
};

const HINT_TONE_FG: Record<'primary' | 'info' | 'success', string> = {
  primary: 'text-primary',
  info: 'text-info',
  success: 'text-success',
};

function PlannerHint({
  tone,
  eyebrow,
  title,
  body,
}: {
  tone: 'primary' | 'info' | 'success';
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-soft bg-background p-2.5">
      <span
        className={cn(
          'w-fit rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
          HINT_TONE_BG[tone],
          HINT_TONE_FG[tone],
        )}
      >
        {eyebrow}
      </span>
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <span className="text-2xs leading-relaxed text-muted-foreground">{body}</span>
    </div>
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
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-soft bg-subtle px-6 py-10 text-center">
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
      {templates.map((t) => {
        const active = value === t.id;
        const sorted = [...t.steps].sort((a, b) => a.ordinal - b.ordinal);
        return (
          <li key={t.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(active ? '' : t.id)}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {t.name}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {t.steps.length} step{t.steps.length === 1 ? '' : 's'}
                </span>
                {active ? <Check size={12} className="shrink-0 text-primary" aria-hidden /> : null}
              </div>
              {t.description ? (
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              ) : null}
              {sorted.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  {sorted.map((step, i) => {
                    const kind = inferAgentKindFromName(step.name);
                    const pal = AGENT_KIND_PALETTE[kind];
                    return (
                      <span key={step.id} className="flex items-center gap-0.5">
                        {i > 0 ? (
                          <span className="text-2xs text-muted-foreground/40">→</span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex max-w-[8rem] items-center gap-1 truncate rounded bg-background px-1.5 py-0.5 text-2xs font-mono',
                            pal.fg,
                          )}
                        >
                          {step.name}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CustomReady({ template, onReset }: { template: Workflow | null; onReset: () => void }) {
  if (!template) return null;
  const sorted = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
          <Check size={10} className="text-success" />
        </span>
        <span className="font-medium text-foreground">
          Workflow ready · {sorted.length} step{sorted.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        >
          <Sparkles size={10} aria-hidden /> Re-design
        </button>
      </div>
      <div className="rounded-md bg-subtle p-3">
        <ol className="flex flex-col gap-1">
          {sorted.map((step, i) => {
            const model = step.modelOverride ? shortModel(step.modelOverride) : null;
            return (
              <li
                key={step.id}
                className="flex items-center gap-2 rounded-md bg-background px-2 py-1 text-xs"
              >
                <span className="font-mono text-2xs text-muted-foreground">{i + 1}.</span>
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    AGENT_KIND_PALETTE[inferAgentKindFromName(step.name)].bg,
                  )}
                />
                <span className="flex-1 truncate font-medium text-foreground">{step.name}</span>
                {model ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                    {model}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
