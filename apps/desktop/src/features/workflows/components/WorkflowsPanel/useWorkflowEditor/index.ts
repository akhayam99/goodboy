import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../shared/components/Toast';
import { undoable } from '../../../../../shared/utils/undoable';
import { deleteWorkflowWithUndo } from '../../../deleteWorkflowWithUndo';
import { editedStepKeys } from '../../../presetEdits';
import type { WorkflowDraft } from '../../../engine';
import { draftFromWorkflow, upsertArgsFromDraft, validateDraft } from '../../../engine';
import { blankWorkflowDraft } from '../../../engine/blankWorkflowDraft';
import { createBlockOf } from '../../../engine/createBlockOf';
import { duplicateWorkflowDraft } from '../../../engine/duplicateWorkflowDraft';
import { hasWorkflowDraftContent } from '../../../engine/hasWorkflowDraftContent';
import { stepDraftsOfArgs } from '../../../engine/stepDraftsOfArgs';
import { useWorkflowDraft } from '../../../engine/useWorkflowDraft';
import { isPresetWorkflow } from '../../../isPresetWorkflow';
import { useWorkflowAutosave } from '../useWorkflowAutosave';

export type EditorTarget = Workflow | 'new' | null;

export type SaveStatus = 'saving' | 'saved' | 'unsaved';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly presets: ReadonlyArray<Workflow>;
  readonly workingDir: string | null;
};

type SavableParams = {
  readonly form: WorkflowDraft;
};

const isSavable = ({ form }: SavableParams): boolean =>
  form.name.trim().length > 0 && form.steps.every((step) => step.name.trim().length > 0);

type StartNewParams = {
  readonly draft: WorkflowDraft;
};

type DuplicateParams = {
  readonly source?: Workflow;
};

type NamesParams = {
  readonly workflows: ReadonlyArray<Workflow>;
};

const liveNamesOf = ({ workflows }: NamesParams): ReadonlySet<string> =>
  new Set(workflows.filter(isPresetWorkflow).map((workflow) => workflow.name));

export const useWorkflowEditor = ({ workspaceId, presets, workingDir }: Params) => {
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId]);
  const storedDraft = useAppStore((state) => state.workflowStudioDrafts[workspaceId]);
  const generation = useAppStore((state) => state.workflowGenerations[workspaceId]);
  const savePhaseTemplate = useAppStore((state) => state.savePhaseTemplate);
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const restoreWorkflowSnapshot = useAppStore((state) => state.restoreWorkflowSnapshot);
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
      ? blankWorkflowDraft()
      : draftFromWorkflow({ workflow: restoredWorkflow }),
  );
  const { draft: form, setDraft: setForm } = useWorkflowDraft({
    initial: storedDraft?.form ?? blankWorkflowDraft(),
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lateTakenName, setLateTakenName] = useState<string | null>(null);
  const editingIdRef = useRef<WorkflowId | null>(restoredWorkflow?.id ?? null);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const handledGenerationRef = useRef<string | null>(null);
  const handledRestoreRef = useRef<string | null>(storedDraft?.restoreNonce ?? null);
  const contextKeyRef = useRef(0);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;
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
      contextKeyRef.current += 1;
      setForm(nextForm);
      setOpenedForm(nextForm);
      savedFormRef.current = JSON.stringify(nextForm);
      setExpandedKey(null);
      setFormError(null);
      setLateTakenName(null);
    },
    [setForm],
  );

  const startNew = useCallback(
    ({ draft }: StartNewParams) => {
      contextKeyRef.current += 1;
      setEditing('new');
      setBaseline(null);
      editingIdRef.current = null;
      setForm(draft);
      setOpenedForm(blankWorkflowDraft());
      savedFormRef.current = null;
      setExpandedKey(null);
      setFormError(null);
      setLateTakenName(null);
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
    undoable({
      showToast,
      message: 'Redrafted the steps.',
      isCurrent: () => (templatesRef.current ?? []).some((template) => template.id === snapshot.id),
      undo: () => restoreWorkflowSnapshot({ workspaceId, snapshot }),
    });
  }, [
    consumeWorkflowGeneration,
    generation,
    load,
    restoreWorkflowSnapshot,
    showToast,
    templates,
    workspaceId,
  ]);

  useEffect(() => {
    if (generation?.status !== 'drafted') {
      return;
    }
    if (handledGenerationRef.current === generation.notificationId) {
      return;
    }
    handledGenerationRef.current = generation.notificationId;
    consumeWorkflowGeneration({ workspaceId });
    if (editingRef.current !== 'new' || generation.draftKey !== contextKeyRef.current) {
      return;
    }
    const steps = stepDraftsOfArgs({ steps: generation.steps });
    const previous = formRef.current.steps;
    const draftKey = generation.draftKey;
    setForm((current) => ({
      ...current,
      steps,
      name: current.name.trim().length === 0 ? generation.name : current.name,
    }));
    if (previous.length === 0) {
      return;
    }
    undoable({
      showToast,
      message: 'Redrafted the steps.',
      isCurrent: () => contextKeyRef.current === draftKey,
      undo: async () => setForm((current) => ({ ...current, steps: previous })),
    });
  }, [consumeWorkflowGeneration, generation, setForm, showToast, workspaceId]);

  useEffect(() => {
    const nonce = storedDraft?.restoreNonce;
    if (storedDraft === undefined || nonce === undefined || handledRestoreRef.current === nonce) {
      return;
    }
    handledRestoreRef.current = nonce;
    if (storedDraft.workflowId === null || storedDraft.workflowId !== editingIdRef.current) {
      return;
    }
    savedFormRef.current = JSON.stringify(storedDraft.form);
    setForm(storedDraft.form);
    setOpenedForm(storedDraft.form);
    setExpandedKey(null);
  }, [setForm, storedDraft]);

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
    const id = editingIdRef.current;
    if (id === null) {
      return false;
    }
    const args = upsertArgsFromDraft({ draft: snapshot, workspaceId, id });
    setSaving(true);
    setFormError(null);
    try {
      await savePhaseTemplate(args);
      savedFormRef.current = JSON.stringify(snapshot);
      clearWorkflowStudioDraft({ workspaceId });
      return true;
    } catch (error) {
      setFormError(formatError(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [clearWorkflowStudioDraft, savePhaseTemplate, workspaceId]);

  const isSavedWorkflow = editing !== null && editing !== 'new';

  useWorkflowAutosave({
    form,
    isEditing: isSavedWorkflow,
    savedForm: savedFormRef,
    flush: flushSave,
  });

  const close = () => {
    contextKeyRef.current += 1;
    setEditing(null);
    setBaseline(null);
    editingIdRef.current = null;
    setForm(blankWorkflowDraft());
    setOpenedForm(blankWorkflowDraft());
    savedFormRef.current = null;
    setExpandedKey(null);
    setFormError(null);
    setLateTakenName(null);
    clearWorkflowStudioDraft({ workspaceId });
  };

  const openNew = () => {
    close();
    startNew({ draft: blankWorkflowDraft() });
  };

  const duplicate = ({ source }: DuplicateParams = {}) => {
    const draft = duplicateWorkflowDraft({
      source: source === undefined ? formRef.current : draftFromWorkflow({ workflow: source }),
    });
    close();
    startNew({ draft });
  };

  const discard = () => {
    const snapshot = formRef.current;
    const hasContent = hasWorkflowDraftContent({ draft: snapshot });
    close();
    if (!hasContent) {
      return;
    }
    undoable({
      showToast,
      message: 'Discarded New workflow',
      isCurrent: () => editingRef.current === null,
      undo: async () => startNew({ draft: snapshot }),
    });
  };

  const create = async () => {
    const snapshot = formRef.current;
    if (isCreating || !isSavable({ form: snapshot }) || snapshot.steps.length === 0) {
      return;
    }
    const name = snapshot.name.trim();
    const contextKey = contextKeyRef.current;
    setIsCreating(true);
    setFormError(null);
    setLateTakenName(null);
    try {
      await loadPhaseTemplates(workspaceId);
      const live = useAppStore.getState().phaseTemplates[workspaceId] ?? [];
      if (contextKeyRef.current !== contextKey) {
        return;
      }
      if (liveNamesOf({ workflows: live }).has(name)) {
        setLateTakenName(name);
        return;
      }
      const saved = await savePhaseTemplate(upsertArgsFromDraft({ draft: snapshot, workspaceId }));
      if (contextKeyRef.current !== contextKey) {
        return;
      }
      editingIdRef.current = saved.id;
      savedFormRef.current = JSON.stringify(snapshot);
      setBaseline(saved);
      setOpenedForm(snapshot);
      setEditing(saved);
      clearWorkflowStudioDraft({ workspaceId });
    } catch (error) {
      if (contextKeyRef.current === contextKey) {
        setFormError(formatError(error));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const remove = async () => {
    const id = editingIdRef.current;
    const workflow = id === null ? null : (presets.find((preset) => preset.id === id) ?? null);
    try {
      if (workflow !== null) {
        await deleteWorkflowWithUndo({
          workflow,
          workspaceId,
          showToast,
          deleteWorkflow,
          restoreWorkflowSnapshot,
        });
      }
    } catch (error) {
      setFormError(formatError(error));
      return;
    }
    close();
  };

  const undoSinceOpened = () => {
    setForm(openedForm);
    setExpandedKey(null);
    setFormError(null);
  };

  const draftSteps = async () => {
    const forGoal = [form.description.trim(), form.entryCheck.trim()]
      .filter((text) => text.length > 0)
      .join('. ');
    if (forGoal.length === 0) {
      setFormError('Say when to use it before drafting steps');
      return;
    }
    setFormError(null);
    const id = editingIdRef.current;
    const workflow = id === null ? null : (presets.find((preset) => preset.id === id) ?? null);
    const accepted = await startWorkflowGeneration({
      workspaceId,
      description: forGoal,
      ...(workingDir !== null && { workingDir }),
      workflow,
      form,
      isDraftOnly: workflow === null,
      draftKey: contextKeyRef.current,
    });
    if (!accepted && generation?.status === 'running') {
      setFormError('Steps are already being drafted in this workspace');
    }
  };

  const editedKeys = useMemo<ReadonlySet<string>>(
    () => (baseline === null ? new Set() : editedStepKeys({ steps: form.steps, preset: baseline })),
    [baseline, form.steps],
  );
  const takenNames = useMemo(() => liveNamesOf({ workflows: presets }), [presets]);
  const isDrafting = generation?.status === 'running';
  const block = createBlockOf({
    draft: form,
    isDrafting,
    takenNames: lateTakenName === null ? takenNames : new Set([...takenNames, lateTakenName]),
  });
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
    contextKey: contextKeyRef.current,
    isSavedWorkflow,
    editingId: editingIdRef.current,
    isCreating,
    createReason: block.reason,
    nameError: block.nameError,
    isGenerating: isDrafting,
    generationError:
      generation?.status === 'failed' ? `Couldn't draft steps. ${generation.error}` : null,
    open: load,
    openNew,
    close,
    duplicate,
    discard,
    create,
    remove,
    undoSinceOpened,
    draftSteps,
  };
};
