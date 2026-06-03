import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Divider, Input, Textarea, cn } from '@goodboy/ui';
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  Step,
  StepDef,
  StepDefId,
  StepId,
  VerbosityLevel,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type {
  WorkflowUpsertArgs,
  WorkflowStepUpsertArgs,
  StepDefUpsertArgs,
} from '../../../../features/workflows/workflows';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
  KIND_TO_ROLE,
  ROLE_LABEL,
  ROLE_TO_KIND,
} from '../../../../features/session/agent-kind';
import { shortModel } from '../../../../features/session/agent-row-format';
import { RoleSelect } from '../../../../features/session/components/RoleSelect';
import { getDefaultTurnModel } from '@goodboy/core';
import {
  modelEffortLevels,
  type EffortLevel,
} from '../../../../features/chat/utils/chat-constants';
import { InlineField } from '../../../../features/session/components/InlineField';
import { ModelSelect } from '../../../../features/session/components/ModelSelect';
import { EffortSelect } from '../../../../features/session/components/EffortSelect';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { ProviderSelect } from '../../../../features/session/components/ProviderSelect';

interface Props {
  readonly workspaceId: WorkspaceId;
}

interface DefinitionForm {
  id?: StepId;
  libraryStepId?: StepDefId;
  role: AgentRole;
  name: string;
  promptPrefix: string;
  providerOverride: string;
  modelOverride: string;
  effort: EffortLevel;
  verbosity: VerbosityLevel;
}

interface TemplateForm {
  name: string;
  description: string;
  steps: DefinitionForm[];
}

const DEFAULT_EFFORT: EffortLevel = 'medium';
const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

const emptyDefinition = (): DefinitionForm => ({
  role: 'custom',
  name: '',
  promptPrefix: '',
  providerOverride: '',
  modelOverride: '',
  effort: DEFAULT_EFFORT,
  verbosity: DEFAULT_VERBOSITY,
});

const emptyForm = (): TemplateForm => ({
  name: '',
  description: '',
  steps: [emptyDefinition()],
});

function templateToForm(t: Workflow): TemplateForm {
  return {
    name: t.name,
    description: t.description,
    steps: t.steps
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((d) => ({
        id: d.id,
        ...(d.libraryStepId !== undefined ? { libraryStepId: d.libraryStepId } : {}),
        role: d.role ?? KIND_TO_ROLE[inferAgentKindFromName(d.name)],
        name: d.name,
        promptPrefix: d.promptPrefix,
        providerOverride: d.providerOverride ?? '',
        modelOverride: d.modelOverride ?? '',
        effort: (d.effort as EffortLevel | undefined) ?? DEFAULT_EFFORT,
        verbosity: d.verbosity ?? DEFAULT_VERBOSITY,
      })),
  };
}

function defFromLibraryStep(s: StepDef): DefinitionForm {
  return {
    libraryStepId: s.id,
    role: s.role,
    name: s.name,
    promptPrefix: s.promptPrefix,
    providerOverride: s.providerDefault ?? '',
    modelOverride: s.modelDefault ?? '',
    effort: (s.effortDefault as EffortLevel | undefined) ?? DEFAULT_EFFORT,
    verbosity: s.verbosityDefault ?? DEFAULT_VERBOSITY,
  };
}

export function WorkflowsPanel({ workspaceId }: Props) {
  const templates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);
  const stepLibrary = useAppStore(
    (s) => s.stepLibrary[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<StepDef>),
  );
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadStepLibrary = useAppStore((s) => s.loadStepLibrary);
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow);
  const saveStepDef = useAppStore((s) => s.saveStepDef);
  const deleteStepDef = useAppStore((s) => s.deleteStepDef);
  const resetWorkflows = useAppStore((s) => s.resetWorkflows);
  const providers = useAppStore((s) => s.providers);
  const connectedProviders = useMemo(
    () => providers.filter((p) => p.connection === 'connected').map((p) => p.id),
    [providers],
  );

  const [editing, setEditing] = useState<Workflow | null | 'new'>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm());
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Restore-to-defaults flow: two-step (confirm) because it overwrites every
  // edit on the built-in presets.
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Pointer-based drag for composing from the library. HTML5 drag-and-drop is
  // intercepted by Tauri's webview drag-drop (used for composer file drops), so
  // we run our own pointer drag instead: a floating ghost follows the cursor and
  // drop zones are hit-tested via elementFromPoint.
  const [drag, setDrag] = useState<{ stepDefId: string; label: string } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dropIndexRef = useRef(dropIndex);
  dropIndexRef.current = dropIndex;

  // Only reusable, non-deleted presets are listed. Deleted-but-attached and
  // one-off custom workflows stay in phaseTemplates for in-session resolution
  // but must not show in the preset manager.
  const presets = templates.filter((t) => t.isPreset !== false && !t.deletedAt);

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
    void loadStepLibrary(workspaceId);
  }, [loadPhaseTemplates, loadStepLibrary, workspaceId]);

  const openNew = () => {
    setEditing('new');
    setForm(emptyForm());
    setExpandedIdx(0);
    setFormError(null);
  };

  const openEdit = (t: Workflow) => {
    setEditing(t);
    setForm(templateToForm(t));
    setExpandedIdx(null);
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormError(null);
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      setFormError('name is required');
      return;
    }
    if (form.steps.some((d) => !d.name.trim())) {
      setFormError('all steps need a name');
      return;
    }

    const defs: WorkflowStepUpsertArgs[] = form.steps.map((d, i) => ({
      ...(d.id !== undefined ? { id: d.id } : {}),
      ...(d.libraryStepId !== undefined ? { libraryStepId: d.libraryStepId } : {}),
      role: d.role,
      ordinal: i,
      name: d.name.trim(),
      promptPrefix: d.promptPrefix,
      ...(d.providerOverride ? { providerOverride: d.providerOverride as ProviderId } : {}),
      ...(d.modelOverride.trim() ? { modelOverride: d.modelOverride.trim() } : {}),
      effort: d.effort as AgentEffort,
      verbosity: d.verbosity,
    }));

    const args: WorkflowUpsertArgs = {
      ...(editing !== 'new' && editing ? { id: editing.id as WorkflowId } : {}),
      workspaceId,
      name: form.name.trim(),
      description: form.description.trim(),
      steps: defs,
    };

    setSaving(true);
    setFormError(null);
    try {
      await savePhaseTemplate(args);
      setEditing(null);
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (t: Workflow) => {
    await deleteWorkflow(t.id, workspaceId);
  };

  const onReset = async () => {
    setResetting(true);
    setFormError(null);
    try {
      await resetWorkflows(workspaceId);
      setEditing(null);
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const activeId = editing !== null && editing !== 'new' ? editing.id : null;

  // ----- step mutations on the centre form -----
  const insertStep = (def: DefinitionForm, atIndex: number) => {
    setForm((prev) => {
      const steps = prev.steps.slice();
      const clamped = Math.max(0, Math.min(atIndex, steps.length));
      steps.splice(clamped, 0, def);
      return { ...prev, steps };
    });
    setExpandedIdx(Math.max(0, Math.min(atIndex, form.steps.length)));
  };

  const insertFromLibrary = (stepDefId: string, atIndex: number) => {
    const def = stepLibrary.find((s) => s.id === stepDefId);
    if (!def) return;
    insertStep(defFromLibraryStep(def), atIndex);
  };

  const updateStep = (idx: number, patch: Partial<DefinitionForm>) => {
    setForm((prev) => {
      const steps = prev.steps.slice();
      steps[idx] = { ...steps[idx], ...patch } as DefinitionForm;
      return { ...prev, steps };
    });
  };

  const removeStep = (idx: number) => {
    setForm((prev) => {
      const next = prev.steps.filter((_, i) => i !== idx);
      return { ...prev, steps: next.length > 0 ? next : [emptyDefinition()] };
    });
    setExpandedIdx(null);
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    setForm((prev) => {
      if (j < 0 || j >= prev.steps.length) return prev;
      const steps = prev.steps.slice();
      [steps[idx], steps[j]] = [steps[j], steps[idx]] as [DefinitionForm, DefinitionForm];
      return { ...prev, steps };
    });
    setExpandedIdx((cur) => (cur === idx ? j : cur === j ? idx : cur));
  };

  const startLibraryDrag = (def: StepDef, e: React.PointerEvent) => {
    if (editing === null) return;
    e.preventDefault();
    setDrag({ stepDefId: def.id, label: def.name });
    setDragPos({ x: e.clientX, y: e.clientY });
    setDropIndex(null);
  };

  // While a library step is being dragged, follow the cursor and hit-test the
  // drop zones (data-dropindex) under it. On release, insert at that index.
  useEffect(() => {
    if (!drag) return;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const onMove = (e: PointerEvent) => {
      setDragPos({ x: e.clientX, y: e.clientY });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zone = el?.closest<HTMLElement>('[data-dropindex]');
      setDropIndex(zone ? Number(zone.dataset.dropindex) : null);
    };
    const onUp = () => {
      const d = dragRef.current;
      const di = dropIndexRef.current;
      if (d && di !== null) insertFromLibrary(d.stepDefId, di);
      setDrag(null);
      setDropIndex(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = prevUserSelect;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  return (
    <div className="flex h-full min-h-0">
      {/* LEFT: the catalogue of workflows. Header pinned, list scrolls. */}
      <aside className="flex w-72 shrink-0 flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 pb-2.5 pt-4">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Presets <span className="text-muted-foreground/50">({presets.length})</span>
          </span>
          <button
            type="button"
            onClick={openNew}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
              editing === 'new'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Plus size={11} aria-hidden /> New
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {presets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-soft bg-subtle/40 px-3 py-6 text-center text-2xs leading-relaxed text-muted-foreground">
              No presets here yet. Create one to chain several agents in a single session.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {presets.map((t) => (
                <PresetCard
                  key={t.id}
                  template={t}
                  active={t.id === activeId}
                  onSelect={() => openEdit(t)}
                  onDelete={() => void onDelete(t)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer: restore the built-in presets if the user has broken them. */}
        <div className="shrink-0 px-4 pb-4 pt-1">
          {confirmReset ? (
            <div className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2">
              <span className="flex-1 text-2xs leading-tight text-muted-foreground">
                Restore the built-in presets? Your edits to them are overwritten. Custom presets you
                made are kept.
              </span>
              <button
                type="button"
                onClick={() => void onReset()}
                disabled={resetting}
                title="confirm restore"
                aria-label="confirm restore defaults"
                className="rounded p-0.5 text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
              >
                <Check size={13} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                title="cancel"
                aria-label="cancel restore defaults"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={cn(
                'inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5',
                'border-border-soft text-2xs font-medium text-muted-foreground transition-colors',
                'hover:border-border hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <RotateCcw size={11} aria-hidden /> Restore defaults
            </button>
          )}
        </div>
      </aside>

      <Divider orientation="vertical" />

      {/* CENTRE: the composer for the selected workflow. */}
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
        {editing !== null ? (
          <Composer
            form={form}
            connectedProviders={connectedProviders}
            expandedIdx={expandedIdx}
            isNew={editing === 'new'}
            saving={saving}
            error={formError}
            dragging={drag !== null}
            dropIndex={dropIndex}
            onChangeMeta={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            onAddBlank={() => insertStep(emptyDefinition(), form.steps.length)}
            onToggleExpand={(idx) => setExpandedIdx((cur) => (cur === idx ? null : idx))}
            onUpdateStep={updateStep}
            onRemoveStep={removeStep}
            onMoveStep={moveStep}
            onSave={() => void onSave()}
            onCancel={cancelEdit}
          />
        ) : (
          <EmptyEditorHint onNew={openNew} hasPresets={presets.length > 0} />
        )}
      </section>

      <Divider orientation="vertical" />

      {/* RIGHT: the library of reusable steps, dragged into the composer. */}
      <StepLibraryPalette
        library={stepLibrary}
        workspaceId={workspaceId}
        connectedProviders={connectedProviders}
        dragDisabled={editing === null}
        onStartDrag={startLibraryDrag}
        onSaveDef={(args) => void saveStepDef(args, workspaceId)}
        onDeleteDef={(id) => void deleteStepDef(id, workspaceId)}
      />

      {/* Floating ghost that follows the cursor while dragging a library step. */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-[60] flex items-center gap-1.5 rounded-md border border-primary/40 bg-background/95 px-2 py-1 text-2xs font-medium text-foreground shadow-lg"
          style={{ left: dragPos.x + 12, top: dragPos.y + 12 }}
        >
          <Plus size={11} className="text-primary" aria-hidden />
          {drag.label}
        </div>
      ) : null}
    </div>
  );
}

function EmptyEditorHint({ onNew, hasPresets }: { onNew: () => void; hasPresets: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
        <Layers size={22} className="text-muted-foreground/40" aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          {hasPresets ? 'Pick a workflow to edit' : 'Design your first workflow'}
        </p>
        <p className="max-w-xs text-2xs leading-relaxed text-muted-foreground">
          {hasPresets
            ? 'Select a preset on the left, or start a new one. Drag steps in from the library on the right.'
            : 'Chain reusable steps, each with its own role, provider and model. Drag them in from the library on the right.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus size={13} aria-hidden /> New workflow
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Centre composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  form: TemplateForm;
  connectedProviders: ReadonlyArray<ProviderId>;
  expandedIdx: number | null;
  isNew: boolean;
  saving: boolean;
  error: string | null;
  dragging: boolean;
  dropIndex: number | null;
  onChangeMeta: (patch: Partial<Pick<TemplateForm, 'name' | 'description'>>) => void;
  onAddBlank: () => void;
  onToggleExpand: (idx: number) => void;
  onUpdateStep: (idx: number, patch: Partial<DefinitionForm>) => void;
  onRemoveStep: (idx: number) => void;
  onMoveStep: (idx: number, dir: -1 | 1) => void;
  onSave: () => void;
  onCancel: () => void;
}

function Composer({
  form,
  connectedProviders,
  expandedIdx,
  isNew,
  saving,
  error,
  dragging,
  dropIndex,
  onChangeMeta,
  onAddBlank,
  onToggleExpand,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  onSave,
  onCancel,
}: ComposerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {isNew ? 'New workflow' : 'Edit workflow'}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            name
          </label>
          <Input
            value={form.name}
            onChange={(e) => onChangeMeta({ name: e.target.value })}
            placeholder="e.g. plan-implement-review"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
            description
          </label>
          <Input
            value={form.description}
            onChange={(e) => onChangeMeta({ description: e.target.value })}
            placeholder="what this workflow is for"
          />
        </div>
      </div>

      <Divider />

      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          steps <span className="text-muted-foreground/50">({form.steps.length})</span>
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
          onClick={onAddBlank}
        >
          <Plus size={11} aria-hidden /> blank step
        </button>
      </div>

      <div className="flex flex-col">
        <StepDropZone index={0} dragging={dragging} active={dropIndex === 0} />
        {form.steps.map((def, idx) => (
          <div key={idx} className="flex flex-col">
            <StepCard
              def={def}
              ordinal={idx}
              total={form.steps.length}
              expanded={expandedIdx === idx}
              connectedProviders={connectedProviders}
              onToggleExpand={() => onToggleExpand(idx)}
              onUpdate={(patch) => onUpdateStep(idx, patch)}
              onRemove={() => onRemoveStep(idx)}
              onMoveUp={() => onMoveStep(idx, -1)}
              onMoveDown={() => onMoveStep(idx, 1)}
            />
            <StepDropZone index={idx + 1} dragging={dragging} active={dropIndex === idx + 1} />
          </div>
        ))}
      </div>

      <Divider />

      <div className="flex items-center justify-end gap-3">
        {error ? <p className="mr-auto text-xs text-danger">{error}</p> : null}
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// Gap between steps. Carries data-dropindex so the pointer-drag hit-test can
// find it. While dragging, every gap shows a thin insertion strip; the one under
// the cursor lights up with a brighter line + a "drop here" pill.
function StepDropZone({
  index,
  dragging,
  active,
}: {
  index: number;
  dragging: boolean;
  active: boolean;
}) {
  return (
    <div
      data-dropindex={index}
      className={cn(
        'relative flex items-center justify-center transition-[height] duration-150',
        !dragging ? 'h-2' : active ? 'h-8' : 'h-4',
      )}
    >
      {dragging ? (
        <>
          {active ? (
            <span className="absolute inset-x-1 inset-y-1 rounded-md bg-primary/10" aria-hidden />
          ) : null}
          <span
            aria-hidden
            className={cn(
              'absolute left-1 right-1 rounded-full transition-all duration-150',
              active ? 'h-0.5 bg-primary' : 'h-px bg-primary/25',
            )}
          />
          {active ? (
            <span className="relative z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium leading-none text-primary-foreground shadow-sm">
              drop here
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StepCard({
  def,
  ordinal,
  total,
  expanded,
  connectedProviders,
  onToggleExpand,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  def: DefinitionForm;
  ordinal: number;
  total: number;
  expanded: boolean;
  connectedProviders: ReadonlyArray<ProviderId>;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<DefinitionForm>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const kind = ROLE_TO_KIND[def.role];
  const effProvider: ProviderId =
    (def.providerOverride as ProviderId) || connectedProviders[0] || 'anthropic';
  const modelValue = def.modelOverride || getDefaultTurnModel(effProvider);

  const onModelChange = (model: string) => {
    const levels = modelEffortLevels(model);
    const patch: Partial<DefinitionForm> = { modelOverride: model };
    if (levels && !levels.includes(def.effort)) patch.effort = levels[0]!;
    onUpdate(patch);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border-soft bg-background">
      <span
        className={cn('absolute inset-y-0 left-0 w-1', AGENT_KIND_PALETTE[kind].bg)}
        aria-hidden
      />

      {/* Collapsed header row, always visible, click to expand. */}
      <div className="flex items-center gap-2 py-2 pl-4 pr-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/50 text-2xs font-mono font-semibold text-muted-foreground">
          {ordinal + 1}
        </span>
        <AgentAvatar kind={kind} size="sm" />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="truncate text-xs font-medium text-foreground">
            {def.name || 'untitled step'}
          </span>
          <span
            className={cn(
              'hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:inline',
              AGENT_KIND_PALETTE[kind].fg,
              'bg-foreground/5',
            )}
          >
            {ROLE_LABEL[def.role]}
          </span>
          {!expanded ? (
            <span className="ml-auto hidden shrink-0 truncate font-mono text-[10px] text-muted-foreground/50 md:inline">
              {shortModel(modelValue)} · {def.verbosity}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveUp}
            disabled={ordinal === 0}
            title="move up"
            aria-label="move step up"
          >
            <ChevronUp size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveDown}
            disabled={ordinal === total - 1}
            title="move down"
            aria-label="move step down"
          >
            <ChevronDown size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
            onClick={onRemove}
            title="remove step"
            aria-label="remove step"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-3 px-4 pb-3 pl-4">
          <div className="flex items-center gap-2">
            <Input
              value={def.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="step name"
              className="h-7 flex-1 text-xs font-medium"
            />
            <div className="w-44 shrink-0">
              <RoleSelect
                value={def.role}
                onChange={(role) => onUpdate({ role })}
                disabled={false}
              />
            </div>
          </div>

          <Textarea
            value={def.promptPrefix}
            onChange={(e) => onUpdate({ promptPrefix: e.target.value })}
            placeholder="role instructions for this step…"
            rows={3}
            autoGrow
            minRows={3}
            maxRows={12}
            className="font-mono text-2xs"
          />

          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <InlineField label="Provider">
              <ProviderSelect
                value={(def.providerOverride as ProviderId) || ''}
                providers={connectedProviders}
                onChange={(p) => onUpdate({ providerOverride: p })}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Model">
              <ModelSelect
                provider={effProvider}
                value={modelValue}
                onChange={onModelChange}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Effort">
              <EffortSelect
                model={modelValue}
                value={def.effort}
                onChange={(effort) => onUpdate({ effort })}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Verbosity">
              <VerbositySelect
                value={def.verbosity}
                onChange={(verbosity) => onUpdate({ verbosity })}
                disabled={false}
              />
            </InlineField>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-hand library palette (drag source)
// ---------------------------------------------------------------------------

function StepLibraryPalette({
  library,
  workspaceId,
  connectedProviders,
  dragDisabled,
  onStartDrag,
  onSaveDef,
  onDeleteDef,
}: {
  library: ReadonlyArray<StepDef>;
  workspaceId: WorkspaceId;
  connectedProviders: ReadonlyArray<ProviderId>;
  dragDisabled: boolean;
  onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  onSaveDef: (args: StepDefUpsertArgs) => void;
  onDeleteDef: (id: StepDefId) => void;
}) {
  const [editing, setEditing] = useState<StepDefId | 'new' | null>(null);

  return (
    <aside className="flex w-80 shrink-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-2 px-4 pb-2.5 pt-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step library
          </span>
          <span className="text-2xs leading-relaxed text-muted-foreground/60">
            {dragDisabled ? 'Open a workflow to drag steps in.' : 'Drag a step into the workflow.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
            editing === 'new'
              ? 'border-primary bg-primary/5 text-foreground'
              : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <Plus size={11} aria-hidden /> New
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ul className="flex flex-col gap-1.5">
          {editing === 'new' ? (
            <li>
              <LibraryStepForm
                def={null}
                workspaceId={workspaceId}
                connectedProviders={connectedProviders}
                onSave={(args) => {
                  onSaveDef(args);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : null}

          {library.length === 0 && editing !== 'new' ? (
            <p className="rounded-lg border border-dashed border-border-soft bg-subtle/40 px-3 py-6 text-center text-2xs leading-relaxed text-muted-foreground">
              No library steps yet. Create one to reuse it across workflows.
            </p>
          ) : null}

          {library.map((def) =>
            editing === def.id ? (
              <li key={def.id}>
                <LibraryStepForm
                  def={def}
                  workspaceId={workspaceId}
                  connectedProviders={connectedProviders}
                  onSave={(args) => {
                    onSaveDef(args);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <LibraryCard
                key={def.id}
                def={def}
                dragDisabled={dragDisabled}
                onStartDrag={onStartDrag}
                onEdit={() => setEditing(def.id)}
                onDelete={() => onDeleteDef(def.id)}
              />
            ),
          )}
        </ul>
      </div>
    </aside>
  );
}

function LibraryCard({
  def,
  dragDisabled,
  onStartDrag,
  onEdit,
  onDelete,
}: {
  def: StepDef;
  dragDisabled: boolean;
  onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const kind = ROLE_TO_KIND[def.role];
  const isGlobal = def.workspaceId === null;
  return (
    <li
      onPointerDown={(e) => {
        if (dragDisabled) return;
        onStartDrag(def, e);
      }}
      className={cn(
        'group relative flex touch-none select-none items-start gap-2 rounded-lg border border-border-soft bg-subtle px-3 py-2 transition-colors hover:border-border hover:bg-muted/50',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        size={13}
        className="mt-0.5 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/60"
        aria-hidden
      />
      <AgentAvatar kind={kind} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate pr-2 text-xs font-medium text-foreground">{def.name}</span>
        <span className={cn('text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
          {ROLE_LABEL[def.role]}
        </span>
        {def.promptPrefix ? (
          <span className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">
            {def.promptPrefix}
          </span>
        ) : null}
      </div>

      {/* top-right: global badge + hover actions. Stop pointerdown so the
          buttons don't start a drag. */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        {isGlobal ? (
          <span className="rounded bg-muted/60 px-1 text-[9px] uppercase tracking-wide text-muted-foreground/60 group-hover:hidden">
            global
          </span>
        ) : null}
        {confirming ? (
          <div
            className="flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="px-1 text-2xs text-muted-foreground">Delete?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              title="confirm delete"
              aria-label={`confirm delete ${def.name}`}
              className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
            >
              <Check size={12} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              title="cancel"
              aria-label="cancel delete"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-0.5 group-hover:flex">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEdit}
              title={isGlobal ? 'edit (creates a workspace copy)' : 'edit step'}
              aria-label={`edit ${def.name}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Pencil size={12} aria-hidden />
            </button>
            {!isGlobal ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setConfirming(true)}
                title="delete step"
                aria-label={`delete ${def.name}`}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}

// Inline editor for a library step (StepDef). Editing a global seed creates a
// workspace override (the original global stays untouched, shared across apps).
function LibraryStepForm({
  def,
  workspaceId,
  connectedProviders,
  onSave,
  onCancel,
}: {
  def: StepDef | null;
  workspaceId: WorkspaceId;
  connectedProviders: ReadonlyArray<ProviderId>;
  onSave: (args: StepDefUpsertArgs) => void;
  onCancel: () => void;
}) {
  const isGlobal = def?.workspaceId === null;
  const [name, setName] = useState(def?.name ?? '');
  const [role, setRole] = useState<AgentRole>(def?.role ?? 'custom');
  const [promptPrefix, setPromptPrefix] = useState(def?.promptPrefix ?? '');
  const [providerOverride, setProviderOverride] = useState<ProviderId | ''>(
    (def?.providerDefault as ProviderId | undefined) ?? '',
  );
  const [modelOverride, setModelOverride] = useState(def?.modelDefault ?? '');
  const [effort, setEffort] = useState<EffortLevel>(
    (def?.effortDefault as EffortLevel | undefined) ?? DEFAULT_EFFORT,
  );
  const [verbosity, setVerbosity] = useState<VerbosityLevel>(
    def?.verbosityDefault ?? DEFAULT_VERBOSITY,
  );

  const effProvider: ProviderId = providerOverride || connectedProviders[0] || 'anthropic';
  const modelValue = modelOverride || getDefaultTurnModel(effProvider);

  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    // Global → create a workspace override; workspace-local → update in place.
    const base: StepDefUpsertArgs = {
      workspaceId,
      role,
      name: name.trim(),
      promptPrefix,
      ...(providerOverride ? { providerDefault: providerOverride } : {}),
      ...(modelOverride.trim() ? { modelDefault: modelOverride.trim() } : {}),
      effortDefault: effort as AgentEffort,
      verbosityDefault: verbosity,
    };
    if (def && !isGlobal) {
      onSave({ ...base, id: def.id });
    } else if (def && isGlobal) {
      onSave({ ...base, baseStepId: def.id });
    } else {
      onSave(base);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/40 bg-background p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="step name"
          className="h-7 flex-1 text-xs font-medium"
        />
        <div className="w-36 shrink-0">
          <RoleSelect value={role} onChange={setRole} disabled={false} />
        </div>
      </div>

      {isGlobal ? (
        <p className="text-2xs leading-relaxed text-muted-foreground/70">
          Editing a global step saves a copy in this workspace. The shared original stays unchanged.
        </p>
      ) : null}

      <Textarea
        value={promptPrefix}
        onChange={(e) => setPromptPrefix(e.target.value)}
        placeholder="default role instructions…"
        rows={3}
        autoGrow
        minRows={3}
        maxRows={10}
        className="font-mono text-2xs"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <InlineField label="Provider">
          <ProviderSelect
            value={providerOverride}
            providers={connectedProviders}
            onChange={setProviderOverride}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Model">
          <ModelSelect
            provider={effProvider}
            value={modelValue}
            onChange={(m) => {
              const levels = modelEffortLevels(m);
              setModelOverride(m);
              if (levels && !levels.includes(effort)) setEffort(levels[0]!);
            }}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Effort">
          <EffortSelect model={modelValue} value={effort} onChange={setEffort} disabled={false} />
        </InlineField>
        <InlineField label="Verbosity">
          <VerbositySelect value={verbosity} onChange={setVerbosity} disabled={false} />
        </InlineField>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function PresetCard({
  template,
  active,
  onSelect,
  onDelete,
}: {
  template: Workflow;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const steps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
          active
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-foreground">{template.name}</span>
          <span className="ml-auto shrink-0 text-2xs text-muted-foreground/40">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </span>
        </div>
        {steps.length > 0 ? (
          <ol className="flex flex-col gap-1">
            {steps.map((step, i) => {
              const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
              const model = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
              const verbosity = step.verbosity ?? 'normal';
              return (
                <li key={step.id} className="flex items-center gap-2">
                  <span className="w-3 shrink-0 text-right text-2xs font-mono text-muted-foreground/40">
                    {i + 1}
                  </span>
                  <AgentAvatar kind={kind} size="xs" />
                  <span
                    className={cn('truncate text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}
                  >
                    {step.name}
                  </span>
                  <span className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground/50">
                    {shortModel(model)} · {verbosity}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </button>
      {confirming ? (
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm backdrop-blur-sm">
          <span className="px-1 text-2xs text-muted-foreground">Delete?</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
              onDelete();
            }}
            title="confirm delete"
            aria-label={`confirm delete ${template.name}`}
            className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
          >
            <Check size={12} aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(false);
            }}
            title="cancel"
            aria-label="cancel delete"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <X size={12} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          title="delete workflow"
          aria-label={`delete ${template.name}`}
          className="absolute right-2 top-2 rounded p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:bg-danger/10 hover:!text-danger"
        >
          <Trash2 size={12} aria-hidden />
        </button>
      )}
    </li>
  );
}
