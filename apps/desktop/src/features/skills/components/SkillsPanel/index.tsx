import { useEffect, useState } from 'react';
import { Button, Input, Textarea } from '@goodboy/ui';
import type { Skill, SkillFrontmatter, WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

interface SkillsPanelProps {
  readonly workspaceId: WorkspaceId;
}

interface EditorForm {
  name: string;
  description: string;
  args: string;
  scripts: string;
  body: string;
}

const emptyForm = (): EditorForm => ({
  name: '',
  description: '',
  args: '',
  scripts: '',
  body: '',
});

function skillToForm(skill: Skill): EditorForm {
  return {
    name: skill.name,
    description: skill.description,
    args: skill.frontmatter.args?.join(', ') ?? '',
    scripts: skill.frontmatter.scripts?.join(', ') ?? '',
    body: skill.body,
  };
}

const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

function validateName(
  name: string,
  existing: ReadonlyArray<Skill>,
  editingId?: string,
): string | null {
  if (!name.trim()) return 'name is required';
  if (!KEBAB_RE.test(name)) return 'name must be kebab-case (lowercase letters, numbers, hyphens)';
  const collision = existing.find((s) => s.name === name && s.id !== editingId);
  if (collision) return 'name already in use';
  return null;
}

function parseChips(raw: string): ReadonlyArray<string> {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SkillsPanel({ workspaceId }: SkillsPanelProps) {
  const skills = useAppStore((s) => s.skills[workspaceId] ?? EMPTY_ARRAY);
  const loadSkills = useAppStore((s) => s.loadSkills);
  const saveSkill = useAppStore((s) => s.saveSkill);
  const deleteSkill = useAppStore((s) => s.deleteSkill);
  const rescanSkills = useAppStore((s) => s.rescanSkills);

  const [editingSkill, setEditingSkill] = useState<Skill | null | 'new'>(null);
  const [form, setForm] = useState<EditorForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills(workspaceId);
  }, [loadSkills, workspaceId]);

  const openNew = () => {
    setEditingSkill('new');
    setForm(emptyForm());
    setFormError(null);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setForm(skillToForm(skill));
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingSkill(null);
    setFormError(null);
  };

  const onSave = async () => {
    const nameErr = validateName(
      form.name,
      skills,
      editingSkill !== 'new' && editingSkill ? editingSkill.id : undefined,
    );
    if (nameErr) {
      setFormError(nameErr);
      return;
    }

    const frontmatter: SkillFrontmatter = {
      name: form.name,
      description: form.description,
      ...(parseChips(form.args).length > 0 ? { args: parseChips(form.args) } : {}),
      ...(parseChips(form.scripts).length > 0 ? { scripts: parseChips(form.scripts) } : {}),
    };

    setSaving(true);
    setFormError(null);
    try {
      await saveSkill({
        workspaceId,
        name: form.name,
        description: form.description,
        frontmatter,
        body: form.body,
        filePath: editingSkill !== 'new' && editingSkill ? editingSkill.filePath : undefined,
      });
      setEditingSkill(null);
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (skill: Skill) => {
    await deleteSkill(skill.id, workspaceId);
  };

  const onRescan = async () => {
    setRescanning(true);
    try {
      await rescanSkills(workspaceId);
    } finally {
      setRescanning(false);
    }
  };

  if (editingSkill !== null) {
    return (
      <SkillEditor
        form={form}
        onChange={setForm}
        onSave={() => void onSave()}
        onCancel={cancelEdit}
        saving={saving}
        error={formError}
        isNew={editingSkill === 'new'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">Skills</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void onRescan()} disabled={rescanning}>
            {rescanning ? 'Rescanning…' : 'Rescan'}
          </Button>
          <Button variant="ghost" size="sm" onClick={openNew}>
            New skill
          </Button>
        </div>
      </div>

      {skills.length === 0 ? (
        <p className="text-2xs text-muted-foreground">
          No skills for this workspace. Create one or rescan the workspace directory.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border-soft bg-subtle shadow-sm">
          {skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              onEdit={() => openEdit(skill)}
              onDelete={() => void onDelete(skill)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillRow({
  skill,
  onEdit,
  onDelete,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">/{skill.name}</span>
        {skill.description ? (
          <span className="text-xs text-muted-foreground">{skill.description}</span>
        ) : null}
        <span className="truncate text-2xs text-muted-foreground/60">{skill.filePath}</span>
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

function SkillEditor({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: {
  form: EditorForm;
  onChange: (f: EditorForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold text-foreground">
        {isNew ? 'New skill' : 'Edit skill'}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-soft bg-subtle p-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Name</label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="my-skill"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Description</label>
          <Input
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="what this skill does"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Args (comma-separated)</label>
            <Input
              value={form.args}
              onChange={(e) => onChange({ ...form, args: e.target.value })}
              placeholder="arg1, arg2"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Scripts (comma-separated)
            </label>
            <Input
              value={form.scripts}
              onChange={(e) => onChange({ ...form, scripts: e.target.value })}
              placeholder="./script.sh"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">Body</label>
          <Textarea
            value={form.body}
            onChange={(e) => onChange({ ...form, body: e.target.value })}
            placeholder="skill prompt body…"
            rows={6}
            className="font-mono text-xs"
          />
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
