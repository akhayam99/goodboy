import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Divider, EmptyState, Input, SectionHeader, cn } from '@goodboy/ui';
import { Check, Layers, Plus, RotateCcw, X } from 'lucide-react';
import { ScrollFade } from '../../../../shared/components/ScrollFade';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
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
import { inferAgentKindFromName, KIND_TO_ROLE } from '../../../../features/session/agent-kind';
import { type EffortLevel } from '../../../../features/chat/utils/chat-constants';
import { StepCard } from '../WorkflowStudio/StepCard';
import { StepDropZone } from '../WorkflowStudio/StepDropZone';
import { PresetCard } from '../PresetCard';
import { LibraryCard } from '../LibraryCard';
import { LibraryStepForm } from '../LibraryStepForm';

interface Props {
  readonly workspaceId: WorkspaceId;
}

export interface DefinitionForm {
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [drag, setDrag] = useState<{ stepDefId: string; label: string } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dropIndexRef = useRef(dropIndex);
  dropIndexRef.current = dropIndex;

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
      <aside className="flex w-72 shrink-0 flex-col">
        <div className="shrink-0 px-3 pb-2 pt-3">
          <SectionHeader
            label={`Presets (${presets.length})`}
            action={
              <button
                type="button"
                onClick={openNew}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
                  editing === 'new'
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <Plus size={11} aria-hidden /> New
              </button>
            }
          />
        </div>

        <ScrollFade className="min-h-0 flex-1 px-3 pb-3">
          {presets.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No presets yet"
              description="Create one to chain several agents in a single session."
              bordered
            />
          ) : (
            <ul className="flex flex-col gap-2">
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
        </ScrollFade>

        <div className="shrink-0 px-3 pb-3 pt-1">
          {confirmReset ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2">
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
                'hover:border-border hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <RotateCcw size={11} aria-hidden /> Restore defaults
            </button>
          )}
        </div>
      </aside>

      <Divider orientation="vertical" />

      <section className="flex min-w-0 flex-1 flex-col">
        {editing !== null ? (
          <ScrollFade className="min-h-0 flex-1">
            <div className="mx-auto max-w-3xl px-8 py-6">
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
            </div>
          </ScrollFade>
        ) : (
          <EmptyEditorHint onNew={openNew} hasPresets={presets.length > 0} />
        )}
      </section>

      <Divider orientation="vertical" />

      <StepLibraryPalette
        library={stepLibrary}
        workspaceId={workspaceId}
        connectedProviders={connectedProviders}
        dragDisabled={editing === null}
        onStartDrag={startLibraryDrag}
        onSaveDef={(args) => void saveStepDef(args, workspaceId)}
        onDeleteDef={(id) => void deleteStepDef(id, workspaceId)}
      />

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
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState
        icon={Layers}
        title={hasPresets ? 'Pick a workflow to edit' : 'Design your first workflow'}
        description={
          hasPresets
            ? 'Select a preset on the left, or start a new one. Drag steps in from the library on the right.'
            : 'Chain reusable steps, each with its own role, provider and model. Drag them in from the library on the right.'
        }
        action={
          <Button size="sm" onClick={onNew}>
            <Plus size={13} aria-hidden /> New workflow
          </Button>
        }
      />
    </div>
  );
}

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
      <SectionHeader label={isNew ? 'New workflow' : 'Edit workflow'} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            name
          </label>
          <Input
            value={form.name}
            onChange={(e) => onChangeMeta({ name: e.target.value })}
            placeholder="e.g. plan-implement-review"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
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

      <SectionHeader
        label={`Steps (${form.steps.length})`}
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
            onClick={onAddBlank}
          >
            <Plus size={11} aria-hidden /> blank step
          </button>
        }
      />

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
    <aside className="flex w-72 shrink-0 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-3">
        <SectionHeader
          label="Step library"
          hint={
            dragDisabled ? 'Open a workflow to drag steps in.' : 'Drag a step into the workflow.'
          }
          action={
            <button
              type="button"
              onClick={() => setEditing('new')}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
                editing === 'new'
                  ? 'border-primary/30 bg-primary/10 text-foreground'
                  : 'border-border-soft text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <Plus size={11} aria-hidden /> New
            </button>
          }
        />
      </div>

      <ScrollFade className="min-h-0 flex-1 px-3 pb-3">
        <ul className="flex flex-col gap-2">
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
            <EmptyState
              icon={Layers}
              title="No library steps yet"
              description="Create one to reuse it across workflows."
              bordered
            />
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
      </ScrollFade>
    </aside>
  );
}
