import { useEffect, useMemo, useState } from 'react';
import { Divider } from '@goodboy/ui';
import type {
  AgentEffort,
  ProviderId,
  StepDef,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { formatError } from '../../../../shared/lib/errors';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { WorkflowUpsertArgs, WorkflowStepUpsertArgs } from '../../workflows';
import type { DefinitionForm, TemplateForm } from '../../form';
import { defFromLibraryStep, emptyDefinition, emptyForm, templateToForm } from '../../form';
import { useWorkflowDrag } from '../../hooks/useWorkflowDrag';
import { DragGhost } from '../WorkflowStudio/DragGhost';
import { WorkflowsRail } from '../WorkflowStudio/WorkflowsRail';
import { WorkflowComposer } from '../WorkflowStudio/WorkflowComposer';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkflowsPanel = ({ workspaceId }: Props) => {
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

  const moveStepTo = (from: number, to: number) => {
    if (to === from || to === from + 1) return;
    const insertAt = to > from ? to - 1 : to;
    setForm((prev) => {
      const steps = prev.steps.slice();
      const [moved] = steps.splice(from, 1);
      steps.splice(insertAt, 0, moved as DefinitionForm);
      return { ...prev, steps };
    });
    setExpandedIdx((cur) => {
      if (cur === null) return null;
      if (cur === from) return insertAt;
      let c = cur > from ? cur - 1 : cur;
      if (c >= insertAt) c += 1;
      return c;
    });
  };

  const { drag, dropIndex, startLibraryDrag, startStepDrag, ghost } = useWorkflowDrag({
    enabled: editing !== null,
    onDropLibrary: insertFromLibrary,
    onReorder: moveStepTo,
  });

  return (
    <div className="flex h-full min-h-0">
      <WorkflowsRail
        presets={presets}
        activeId={activeId}
        editing={editing}
        resetting={resetting}
        confirmReset={confirmReset}
        setConfirmReset={setConfirmReset}
        onSelect={openEdit}
        onNew={openNew}
        onDelete={(t) => void onDelete(t)}
        onReset={() => void onReset()}
      />

      <Divider orientation="vertical" />

      <WorkflowComposer
        open={editing !== null}
        isNew={editing === 'new'}
        hasPresets={presets.length > 0}
        form={form}
        workspaceId={workspaceId}
        connectedProviders={connectedProviders}
        library={stepLibrary}
        expandedIdx={expandedIdx}
        saving={saving}
        error={formError}
        dragging={drag !== null}
        dropIndex={dropIndex}
        onNew={openNew}
        onChangeMeta={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onAddBlank={() => {
          insertStep(emptyDefinition(), form.steps.length);
          setExpandedIdx(form.steps.length);
        }}
        onToggleExpand={(idx) => setExpandedIdx((cur) => (cur === idx ? null : idx))}
        onUpdateStep={updateStep}
        onRemoveStep={removeStep}
        onMoveStep={moveStep}
        draggingStepIdx={drag?.kind === 'step' ? drag.fromIndex : null}
        onStartDrag={startLibraryDrag}
        onStartStepDrag={startStepDrag}
        onSaveDef={(args) => void saveStepDef(args, workspaceId)}
        onDeleteDef={(id) => void deleteStepDef(id, workspaceId)}
        onSave={() => void onSave()}
        onCancel={cancelEdit}
      />

      <DragGhost ghost={ghost} />
    </div>
  );
};
