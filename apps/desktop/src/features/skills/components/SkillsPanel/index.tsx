import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Button,
  Divider,
  EmptyState,
  FieldRow,
  InlineConfirm,
  Input,
  SectionHeader,
  SelectableRow,
  Textarea,
} from '@goodboy/ui';
import type { Skill, SkillFrontmatter, WorkspaceId } from '@goodboy/types';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { formatError } from '../../../../shared/lib/errors';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type EditorForm = {
  readonly name: string;
  readonly description: string;
  readonly args: string;
  readonly scripts: string;
  readonly body: string;
};

const emptyForm = (): EditorForm => ({
  name: '',
  description: '',
  args: '',
  scripts: '',
  body: '',
});

type SkillToFormParams = {
  readonly skill: Skill;
};

const skillToForm = ({ skill }: SkillToFormParams): EditorForm => ({
  name: skill.name,
  description: skill.description,
  args: skill.frontmatter.args?.join(', ') ?? '',
  scripts: skill.frontmatter.scripts?.join(', ') ?? '',
  body: skill.body,
});

const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

type ValidateNameParams = {
  readonly name: string;
  readonly existing: ReadonlyArray<Skill>;
  readonly editingId: string | undefined;
};

const validateName = ({ name, existing, editingId }: ValidateNameParams): string | null => {
  if (name.trim() === '') {
    return 'name is required';
  }
  if (!KEBAB_RE.test(name)) {
    return 'name must be kebab-case (lowercase letters, numbers, hyphens)';
  }
  const collision = existing.find((s) => s.name === name && s.id !== editingId);
  if (collision !== undefined) {
    return 'name already in use';
  }
  return null;
};

type ParseChipsParams = {
  readonly raw: string;
};

const parseChips = ({ raw }: ParseChipsParams): ReadonlyArray<string> =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

export const SkillsPanel = ({ workspaceId }: Props) => {
  const skills = useAppStore((s) => s.skills[workspaceId] ?? EMPTY_ARRAY);
  const loadSkills = useAppStore((s) => s.loadSkills);
  const saveSkill = useAppStore((s) => s.saveSkill);
  const deleteSkill = useAppStore((s) => s.deleteSkill);
  const rescanSkills = useAppStore((s) => s.rescanSkills);
  const { showToast } = useToast();

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
    setForm(skillToForm({ skill }));
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingSkill(null);
    setFormError(null);
  };

  const onSave = async () => {
    const nameErr = validateName({
      name: form.name,
      existing: skills,
      editingId: editingSkill !== 'new' && editingSkill !== null ? editingSkill.id : undefined,
    });
    if (nameErr !== null) {
      setFormError(nameErr);
      return;
    }

    const frontmatter: SkillFrontmatter = {
      name: form.name,
      description: form.description,
      ...(parseChips({ raw: form.args }).length > 0
        ? { args: parseChips({ raw: form.args }) }
        : {}),
      ...(parseChips({ raw: form.scripts }).length > 0
        ? { scripts: parseChips({ raw: form.scripts }) }
        : {}),
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
        filePath:
          editingSkill !== 'new' && editingSkill !== null ? editingSkill.filePath : undefined,
      });
      setEditingSkill(null);
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (skill: Skill) => {
    try {
      await deleteSkill(skill.id, workspaceId);
    } catch (err) {
      showToast('error', formatError(err), { title: 'delete failed' });
    }
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
      <SectionHeader
        label="Skills"
        icon={<SECTION_ICONS.skills size={13} aria-hidden />}
        hint="Reusable prompt fragments agents can opt into."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void onRescan()} disabled={rescanning}>
              {rescanning ? 'Rescanning…' : 'Rescan'}
            </Button>
            <Button variant="ghost" size="sm" onClick={openNew}>
              New skill
            </Button>
          </div>
        }
      />

      {skills.length === 0 ? (
        <EmptyState
          icon={SECTION_ICONS.skills}
          title="No skills yet"
          description="A skill is a reusable prompt fragment agents can opt into by name. Create one, or rescan to pick up skill files already on disk."
          action={
            <Button size="sm" onClick={openNew}>
              New skill
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {skills.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              onEdit={() => openEdit(skill)}
              onDelete={() => onDelete(skill)}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

type SkillRowProps = {
  readonly skill: Skill;
  readonly onEdit: () => void;
  readonly onDelete: () => Promise<void>;
};

const SkillRow = ({ skill, onEdit, onDelete }: SkillRowProps) => {
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);

  return (
    <li className="group relative">
      <SelectableRow
        selected={false}
        onClick={onEdit}
        className="flex-col items-start gap-0.5 px-2.5 py-2 pr-9"
      >
        <span className="truncate text-sm font-medium text-foreground">/{skill.name}</span>
        {skill.description !== '' ? (
          <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
        ) : null}
        <span className="truncate text-2xs text-muted-foreground/60">{skill.filePath}</span>
      </SelectableRow>
      <button
        type="button"
        aria-label="Delete"
        title={`Delete ${skill.name}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsDeleteArmed(true);
        }}
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/0 motion-safe:transition-colors focus-visible:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] group-focus-within:text-muted-foreground group-hover:text-muted-foreground hover:!text-danger hover:bg-danger/10"
      >
        <Trash2 size={13} aria-hidden />
      </button>

      {isDeleteArmed ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={12} aria-hidden />}
          title={`Delete "${skill.name}"?`}
          description="Permanently removes this skill from the workspace."
          confirmLabel={`Delete ${skill.name}`}
          autoDisarmMs={4000}
          onConfirm={async () => {
            await onDelete();
            setIsDeleteArmed(false);
          }}
          onCancel={() => setIsDeleteArmed(false)}
        />
      ) : null}
    </li>
  );
};

type SkillEditorProps = {
  readonly form: EditorForm;
  readonly onChange: (f: EditorForm) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly saving: boolean;
  readonly error: string | null;
  readonly isNew: boolean;
};

const SkillEditor = ({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: SkillEditorProps) => {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!saving) {
        onSave();
      }
    }
  };

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <SectionHeader label={isNew ? 'New skill' : 'Edit skill'} />

      <section className="flex flex-col">
        <FieldRow label="Name">
          <Input
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="my-skill"
            autoFocus
            disabled={saving}
            className="w-full sm:w-72"
          />
        </FieldRow>
        <Divider />
        <FieldRow label="Description">
          <Input
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            placeholder="what this skill does"
            disabled={saving}
            className="w-full sm:w-72"
          />
        </FieldRow>
        <Divider />
        <FieldRow label="Args" help="Comma-separated list of argument names.">
          <Input
            value={form.args}
            onChange={(e) => onChange({ ...form, args: e.target.value })}
            placeholder="arg1, arg2"
            disabled={saving}
            className="w-full sm:w-72"
          />
        </FieldRow>
        <Divider />
        <FieldRow label="Scripts" help="Comma-separated list of script paths.">
          <Input
            value={form.scripts}
            onChange={(e) => onChange({ ...form, scripts: e.target.value })}
            placeholder="./script.sh"
            disabled={saving}
            className="w-full sm:w-72"
          />
        </FieldRow>
        <Divider />
        <FieldRow label="Body">
          <Textarea
            value={form.body}
            onChange={(e) => onChange({ ...form, body: e.target.value })}
            placeholder="skill prompt body…"
            rows={6}
            disabled={saving}
            className="w-full font-mono text-xs sm:w-96"
          />
        </FieldRow>
      </section>

      <Divider />
      <footer className="flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          {error !== null ? (
            <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertTriangle size={12} aria-hidden />
              {error}
            </span>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </footer>
    </div>
  );
};
