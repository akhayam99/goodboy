import { useEffect, useState } from 'react';
import { Button, Input, Select, Textarea } from '@kay-am/ui';
import type { Step, StepId, Workflow, WorkflowId, WorkspaceId } from '@kay-am/types';
import type { ProviderId } from '@kay-am/types';
import { EMPTY_ARRAY, useAppStore } from '../store';
import type { PhaseTemplateUpsertArgs, PhaseDefinitionUpsertArgs } from '../phases';

interface PhasesPanelProps {
  readonly workspaceId: WorkspaceId;
}

interface DefinitionForm {
  id?: StepId;
  name: string;
  promptPrefix: string;
  providerOverride: string;
  modelOverride: string;
}

interface TemplateForm {
  name: string;
  description: string;
  steps: DefinitionForm[];
}

const emptyDefinition = (): DefinitionForm => ({
  name: '',
  promptPrefix: '',
  providerOverride: '',
  modelOverride: '',
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
        name: d.name,
        promptPrefix: d.promptPrefix,
        providerOverride: d.providerOverride ?? '',
        modelOverride: d.modelOverride ?? '',
      })),
  };
}

const PROVIDER_IDS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

export function PhasesPanel({ workspaceId }: PhasesPanelProps) {
  const templates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow);

  const [editing, setEditing] = useState<Workflow | null | 'new'>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
  }, [loadPhaseTemplates, workspaceId]);

  const openNew = () => {
    setEditing('new');
    setForm(emptyForm());
    setFormError(null);
  };

  const openEdit = (t: Workflow) => {
    setEditing(t);
    setForm(templateToForm(t));
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

    const defs: PhaseDefinitionUpsertArgs[] = form.steps.map((d, i) => ({
      ...(d.id !== undefined ? { id: d.id } : {}),
      ordinal: i,
      name: d.name.trim(),
      promptPrefix: d.promptPrefix,
      ...(d.providerOverride ? { providerOverride: d.providerOverride as ProviderId } : {}),
      ...(d.modelOverride.trim() ? { modelOverride: d.modelOverride.trim() } : {}),
    }));

    const args: PhaseTemplateUpsertArgs = {
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
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (t: Workflow) => {
    await deleteWorkflow(t.id, workspaceId);
  };

  if (editing !== null) {
    return (
      <PhaseEditor
        form={form}
        onChange={setForm}
        onSave={() => void onSave()}
        onCancel={cancelEdit}
        saving={saving}
        error={formError}
        isNew={editing === 'new'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">Workflows</div>
        <Button variant="ghost" size="sm" onClick={openNew}>
          New workflow
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="text-2xs text-muted-foreground">
          No workflows for this workspace. Create one to chain multiple agents per session.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle shadow-sm">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onEdit={() => openEdit(t)}
              onDelete={() => void onDelete(t)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: Workflow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{template.name}</span>
        {template.description ? (
          <span className="text-xs text-muted-foreground">{template.description}</span>
        ) : null}
        <span className="text-2xs text-muted-foreground/60">
          {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-foreground"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-danger"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function PhaseEditor({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: {
  form: TemplateForm;
  onChange: (f: TemplateForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
}) {
  const addDefinition = () => {
    onChange({ ...form, steps: [...form.steps, emptyDefinition()] });
  };

  const removeDefinition = (idx: number) => {
    const next = form.steps.filter((_, i) => i !== idx);
    onChange({ ...form, steps: next.length > 0 ? next : [emptyDefinition()] });
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = form.steps.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]] as [DefinitionForm, DefinitionForm];
    onChange({ ...form, steps: next });
  };

  const moveDown = (idx: number) => {
    if (idx === form.steps.length - 1) return;
    const next = form.steps.slice();
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]] as [DefinitionForm, DefinitionForm];
    onChange({ ...form, steps: next });
  };

  const updateDef = (idx: number, patch: Partial<DefinitionForm>) => {
    const next = form.steps.slice();
    next[idx] = { ...next[idx], ...patch } as DefinitionForm;
    onChange({ ...form, steps: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-foreground">
        {isNew ? 'New workflow' : 'Edit workflow'}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">name</label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. plan-implement-review"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">description</label>
          <Input
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="what this template is for"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">steps</span>
            <button
              type="button"
              className="text-xs text-primary underline hover:opacity-80"
              onClick={addDefinition}
            >
              add step
            </button>
          </div>

          {form.steps.map((def, idx) => (
            <DefinitionEditor
              key={idx}
              def={def}
              ordinal={idx}
              total={form.steps.length}
              onUpdate={(patch) => updateDef(idx, patch)}
              onRemove={() => removeDefinition(idx)}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
            />
          ))}
        </div>

        {error ? <p className="text-xs text-danger">{error}</p> : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DefinitionEditor({
  def,
  ordinal,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  def: DefinitionForm;
  ordinal: number;
  total: number;
  onUpdate: (patch: Partial<DefinitionForm>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border-soft bg-background p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-muted-foreground">step {ordinal + 1}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveUp}
            disabled={ordinal === 0}
            title="move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveDown}
            disabled={ordinal === total - 1}
            title="move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-danger"
            onClick={onRemove}
            title="remove step"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-2xs font-semibold text-foreground">name</label>
          <Input
            value={def.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="planner"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-2xs font-semibold text-foreground">prompt prefix</label>
        <Textarea
          value={def.promptPrefix}
          onChange={(e) => onUpdate({ promptPrefix: e.target.value })}
          placeholder="You are in the planning step. Your goal is to…"
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-2xs font-semibold text-foreground">provider override</label>
          <Select
            size="sm"
            block
            value={def.providerOverride}
            onChange={(e) => onUpdate({ providerOverride: e.target.value })}
          >
            <option value="">default</option>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-2xs font-semibold text-foreground">model override</label>
          <Input
            value={def.modelOverride}
            onChange={(e) => onUpdate({ modelOverride: e.target.value })}
            placeholder="e.g. claude-opus-4-5"
          />
        </div>
      </div>
    </div>
  );
}
