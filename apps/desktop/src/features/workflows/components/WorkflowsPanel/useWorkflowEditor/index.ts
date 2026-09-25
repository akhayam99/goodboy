import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../app/components/Toast';
import { editedStepKeys } from '../../../../session/components/WorkflowBuilderView/presetEdits';
import type { WorkflowDraft } from '../../../engine';
import { draftFromWorkflow, upsertArgsFromDraft, validateDraft } from '../../../engine';
import { useWorkflowDraft } from '../../../engine/useWorkflowDraft';
import { useWorkflowAutosave } from '../useWorkflowAutosave';

export type EditorTarget = Workflow | 'new' | null;

export type SaveStatus = 'saving' | 'saved' | 'unsaved';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly presets: ReadonlyArray<Workflow>;
  readonly workingDir: string | null;
};

const emptyWorkflowDraft = (): WorkflowDraft => ({
  name: '',
  description: '',
  goal: '',
  steps: [],
  origin: 'custom',
  isPreset: true,
});

type SavableParams = {
  readonly form: WorkflowDraft;
};

const isSavable = ({ form }: SavableParams): boolean =>
  form.name.trim().length > 0 && form.steps.every((step) => step.name.trim().length > 0);

export const useWorkflowEditor = ({ workspaceId, presets, workingDir }: Params) => {
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId]);
  const storedDraft = useAppStore((state) => state.workflowStudioDrafts[workspaceId]);
  const generation = useAppStore((state) => state.workflowGenerations[workspaceId]);
  const savePhaseTemplate = useAppStore((state) => state.savePhaseTemplate);
  const deleteWorkflow = useAppStore((state) => state.deleteWorkflow);
  const setWorkflowStudioDraft = useAppStore((state) => state.setWorkflowStudioDraft);
  const clearWorkflowStudioDraft = useAppStore((state) => state.clearWorkflowStudioDraft);
  const startWorkflowGeneration = useAppStore((state) => state.startWorkflowGeneration);
  const consumeWorkflowGeneration = useAppStore((state) => state.consumeWorkflowGeneration);
  const { showToast } = useToast();

  const restoredWorkflow =
    storedDraft?.workflowId == null
      ? null
      : (presets.find((workflow) => workflow.id === storedDraft.workflowId) ?? null);
  const [editing, setEditing] = useState<EditorTarget>(() =>
    storedDraft === undefined ? null : (restoredWorkflow ?? 'new'),
  );
  const [baseline, setBaseline] = useState<Workflow | null>(restoredWorkflow);
  const [openedForm, setOpenedForm] = useState<WorkflowDraft>(() =>
    restoredWorkflow === null
      ? emptyWorkflowDraft()
      : draftFromWorkflow({ workflow: restoredWorkflow }),
  );
  const { draft: form, setDraft: setForm } = useWorkflowDraft({
    initial: storedDraft?.form ?? emptyWorkflowDraft(),
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirmingRedraft, setIsConfirmingRedraft] = useState(false);
  const editingIdRef = useRef<WorkflowId | null>(restoredWorkflow?.id ?? null);
  const handledGenerationRef = useRef<string | null>(null);
  const formRef = useRef(form);
  const savedFormRef = useRef<string | null>(
    restoredWorkflow === null
      ? null
      : JSON.stringify(draftFromWorkflow({ workflow: restoredWorkflow })),
  );
  formRef.current = form;

  const load = useCallback(
    (workflow: Workflow) => {
      const nextForm = draftFromWorkflow({ workflow });
      setEditing(workflow);
      setBaseline(workflow);
      editingIdRef.current = workflow.id;
      setForm(nextForm);
      setOpenedForm(nextForm);
      savedFormRef.current = JSON.stringify(nextForm);
      setExpandedKey(null);
      setFormError(null);
      setIsConfirmingRedraft(false);
    },
    [setForm],
  );

  useEffect(() => {
    if (generation?.status !== 'complete') {
      return;
    }
    if (handledGenerationRef.current === generation.notificationId) {
      return;
    }
    const workflow = templates?.find((template) => template.id === generation.workflowId);
    if (workflow === undefined) {
      return;
    }
    handledGenerationRef.current = generation.notificationId;
    const snapshot = generation.undoSnapshot;
    load(workflow);
    consumeWorkflowGeneration({ workspaceId });
    if (snapshot === null) {
      return;
    }
    showToast({
      kind: 'success',
      message: 'Redrafted the steps.',
      action: {
        label: 'Undo',
        onClick: () => setForm(draftFromWorkflow({ workflow: snapshot })),
      },
    });
  }, [consumeWorkflowGeneration, generation, load, setForm, showToast, templates, workspaceId]);

  useEffect(() => {
    if (editing === null) {
      return;
    }
    setWorkflowStudioDraft({ workspaceId, draft: { workflowId: editingIdRef.current, form } });
  }, [editing, form, setWorkflowStudioDraft, workspaceId]);

  const flushSave = useCallback(async (): Promise<boolean> => {
    const snapshot = formRef.current;
    const errors = validateDraft({ draft: snapshot });
    if (errors.name !== undefined) {
      setFormError(errors.name);
      return false;
    }
    if (errors.steps !== undefined) {
      setFormError(errors.steps);
      return false;
    }
    if (Object.keys(errors.stepNames).length > 0) {
      setFormError('All steps need a name');
      return false;
    }
    const args = upsertArgsFromDraft({
      draft: snapshot,
      workspaceId,
      ...(editingIdRef.current !== null && { id: editingIdRef.current }),
    });
    setSaving(true);
    setFormError(null);
    try {
      const saved = await savePhaseTemplate(args);
      editingIdRef.current = saved.id;
      savedFormRef.current = JSON.stringify(snapshot);
      if (editing === 'new') {
        setEditing(saved);
      }
      clearWorkflowStudioDraft({ workspaceId });
      return true;
    } catch (error) {
      setFormError(formatError(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [clearWorkflowStudioDraft, editing, savePhaseTemplate, workspaceId]);

  useWorkflowAutosave({
    form,
    isEditing: editing !== null && !(editingIdRef.current === null && form.steps.length === 0),
    savedForm: savedFormRef,
    flush: flushSave,
  });

  const close = () => {
    setEditing(null);
    setBaseline(null);
    editingIdRef.current = null;
    setForm(emptyWorkflowDraft());
    setOpenedForm(emptyWorkflowDraft());
    savedFormRef.current = null;
    setExpandedKey(null);
    setFormError(null);
    setIsConfirmingRedraft(false);
    clearWorkflowStudioDraft({ workspaceId });
  };

  const openNew = () => {
    close();
    setEditing('new');
  };

  const duplicate = async () => {
    const source = formRef.current;
    try {
      const saved = await savePhaseTemplate(
        upsertArgsFromDraft({
          workspaceId,
          draft: {
            ...source,
            name: `${source.name.trim()} copy`,
            origin: 'custom',
            steps: source.steps.map((step) => ({ ...step, sourceStepId: null })),
          },
        }),
      );
      load(saved);
    } catch (error) {
      setFormError(formatError(error));
    }
  };

  const remove = async () => {
    const id = editingIdRef.current;
    if (id !== null) {
      await deleteWorkflow(id, workspaceId);
    }
    close();
  };

  const undoSinceOpened = () => {
    setForm(openedForm);
    setExpandedKey(null);
    setFormError(null);
  };

  const draftSteps = async () => {
    const goal = form.goal.trim();
    if (goal.length === 0) {
      setFormError('Add a goal before drafting steps');
      return;
    }
    setIsConfirmingRedraft(false);
    setFormError(null);
    const id = editingIdRef.current;
    const workflow = id === null ? null : (presets.find((preset) => preset.id === id) ?? null);
    const accepted = await startWorkflowGeneration({
      workspaceId,
      description: goal,
      ...(workingDir !== null && { workingDir }),
      workflow,
      form,
    });
    if (!accepted && generation?.status === 'running') {
      setFormError('Steps are already being drafted in this workspace');
    }
  };

  const editedKeys = useMemo<ReadonlySet<string>>(
    () => (baseline === null ? new Set() : editedStepKeys({ steps: form.steps, preset: baseline })),
    [baseline, form.steps],
  );
  const isDirty = JSON.stringify(form) !== JSON.stringify(openedForm);
  const isSaved = savedFormRef.current !== null && JSON.stringify(form) === savedFormRef.current;
  const saveStatus: SaveStatus = saving
    ? 'saving'
    : isSaved
      ? 'saved'
      : isSavable({ form }) && formError === null
        ? 'saving'
        : 'unsaved';

  return {
    editing,
    form,
    setForm,
    expandedKey,
    setExpandedKey,
    formError,
    saveStatus,
    editedKeys,
    isDirty,
    isSavedWorkflow: editingIdRef.current !== null,
    isGenerating: generation?.status === 'running',
    generationError: generation?.status === 'failed' ? generation.error : null,
    isConfirmingRedraft,
    setIsConfirmingRedraft,
    open: load,
    openNew,
    close,
    duplicate,
    remove,
    undoSinceOpened,
    draftSteps,
  };
};
