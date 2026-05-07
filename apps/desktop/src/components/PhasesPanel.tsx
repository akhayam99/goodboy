import { useEffect, useState } from 'react';
import { Button, Input, Textarea } from '@kay-am/ui';
import type {
  PhaseDefinition,
  PhaseDefinitionId,
  PhaseTemplate,
  PhaseTemplateId,
  WorkspaceId,
} from '@kay-am/types';
import type { ProviderId } from '@kay-am/types';
import { useAppStore } from '../store';
import type { PhaseTemplateUpsertArgs, PhaseDefinitionUpsertArgs } from '../phases';

interface PhasesPanelProps {
  readonly workspaceId: WorkspaceId;
}

interface DefinitionForm {
  id?: PhaseDefinitionId;
  name: string;
  promptPrefix: string;
  providerOverride: string;
  modelOverride: string;
}

interface TemplateForm {
  name: string;
  description: string;
  definitions: DefinitionForm[];
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
  definitions: [emptyDefinition()],
});

function templateToForm(t: PhaseTemplate): TemplateForm {
  return {
    name: t.name,
    description: t.description,
    definitions: t.definitions
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
  const templates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? []);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate);
  const deletePhaseTemplate = useAppStore((s) => s.deletePhaseTemplate);

  const [editing, setEditing] = useState<PhaseTemplate | null | 'new'>(null);
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

  const openEdit = (t: PhaseTemplate) => {
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
    if (form.definitions.some((d) => !d.name.trim())) {
      setFormError('all phase definitions need a name');
      return;
    }

    const defs: PhaseDefinitionUpsertArgs[] = form.definitions.map((d, i) => ({
      ...(d.id !== undefined ? { id: d.id } : {}),
      ordinal: i,
      name: d.name.trim(),
      promptPrefix: d.promptPrefix,
      ...(d.providerOverride ? { providerOverride: d.providerOverride as ProviderId } : {}),
      ...(d.modelOverride.trim() ? { modelOverride: d.modelOverride.trim() } : {}),
    }));

    const args: PhaseTemplateUpsertArgs = {
      ...(editing !== 'new' && editing ? { id: editing.id as PhaseTemplateId } : {}),
      workspaceId,
      name: form.name.trim(),
      description: form.description.trim(),
      definitions: defs,
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

  const onDelete = async (t: PhaseTemplate) => {
    await deletePhaseTemplate(t.id, workspaceId);
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
        <div className="text-xs font-semibold text-foreground">phase templates</div>
        <Button variant="ghost" size="sm" onClick={openNew}>
          new template
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          no phase templates for this workspace. create one to run multi-phase sessions.
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
  template: PhaseTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{template.name}</span>
        {template.description ? (
          <span className="text-[11px] text-muted-foreground">{template.description}</span>
        ) : null}
        <span className="text-[10px] text-muted-foreground/60">
          {template.definitions.length} phase{template.definitions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline hover:text-foreground"
          onClick={onEdit}
        >
          edit
        </button>
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline hover:text-danger"
          onClick={onDelete}
        >
          delete
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
    onChange({ ...form, definitions: [...form.definitions, emptyDefinition()] });
  };

  const removeDefinition = (idx: number) => {
    const next = form.definitions.filter((_, i) => i !== idx);
    onChange({ ...form, definitions: next.length > 0 ? next : [emptyDefinition()] });
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = form.definitions.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]] as [DefinitionForm, DefinitionForm];
    onChange({ ...form, definitions: next });
  };

  const moveDown = (idx: number) => {
    if (idx === form.definitions.length - 1) return;
    const next = form.definitions.slice();
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]] as [DefinitionForm, DefinitionForm];
    onChange({ ...form, definitions: next });
  };

  const updateDef = (idx: number, patch: Partial<DefinitionForm>) => {
    const next = form.definitions.slice();
    next[idx] = { ...next[idx], ...patch } as DefinitionForm;
    onChange({ ...form, definitions: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-foreground">
        {isNew ? 'new phase template' : 'edit phase template'}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-foreground">name</label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g. plan-implement-review"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-foreground">description</label>
          <Input
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="what this template is for"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">phases</span>
            <button
              type="button"
              className="text-[11px] text-primary underline hover:opacity-80"
              onClick={addDefinition}
            >
              add phase
            </button>
          </div>

          {form.definitions.map((def, idx) => (
            <DefinitionEditor
              key={idx}
              def={def}
              ordinal={idx}
              total={form.definitions.length}
              onUpdate={(patch) => updateDef(idx, patch)}
              onRemove={() => removeDefinition(idx)}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
            />
          ))}
        </div>

        {error ? <p className="text-[11px] text-danger">{error}</p> : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'saving…' : 'save'}
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
        <span className="text-[10px] font-semibold text-muted-foreground">phase {ordinal + 1}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveUp}
            disabled={ordinal === 0}
            title="move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={onMoveDown}
            disabled={ordinal === total - 1}
            title="move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-danger"
            onClick={onRemove}
            title="remove phase"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[10px] font-semibold text-foreground">name</label>
          <Input
            value={def.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="planner"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-foreground">prompt prefix</label>
        <Textarea
          value={def.promptPrefix}
          onChange={(e) => onUpdate({ promptPrefix: e.target.value })}
          placeholder="You are in the planning phase. Your goal is to…"
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[10px] font-semibold text-foreground">provider override</label>
          <select
            value={def.providerOverride}
            onChange={(e) => onUpdate({ providerOverride: e.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">default</option>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[10px] font-semibold text-foreground">model override</label>
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
