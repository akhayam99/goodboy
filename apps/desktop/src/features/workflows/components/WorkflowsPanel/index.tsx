import { useEffect, useMemo, useRef, useState } from 'react'
import { Divider } from '@goodboy/ui'
import { formatWorkflowFromNL, type FormattedWorkflow } from '@goodboy/core'
import { invoke } from '@tauri-apps/api/core'
import type {
  AgentEffort,
  ProviderId,
  StepDef,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types'
import { formatError } from '../../../../shared/lib/errors'
import { useToast } from '../../../../app/components/Toast'
import { EMPTY_ARRAY, useAppStore } from '../../../../store'
import type { WorkflowUpsertArgs, WorkflowStepUpsertArgs } from '../../workflows'
import type { DefinitionForm, TemplateForm } from '../../form'
import { defFromLibraryStep, emptyDefinition, emptyForm, templateToForm } from '../../form'
import { useWorkflowDrag } from '../../hooks/useWorkflowDrag'
import { DragGhost } from '../WorkflowStudio/DragGhost'
import { WorkflowsRail } from '../WorkflowStudio/WorkflowsRail'
import { WorkflowComposer } from '../WorkflowStudio/WorkflowComposer'
import { WorkflowFormatPreview } from '../WorkflowStudio/WorkflowFormatPreview'

type Props = {
  readonly workspaceId: WorkspaceId
}

export const WorkflowsPanel = ({ workspaceId }: Props) => {
  const templates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? EMPTY_ARRAY)
  const stepLibrary = useAppStore(
    (s) => s.stepLibrary[workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<StepDef>),
  )
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates)
  const loadStepLibrary = useAppStore((s) => s.loadStepLibrary)
  const savePhaseTemplate = useAppStore((s) => s.savePhaseTemplate)
  const deleteWorkflow = useAppStore((s) => s.deleteWorkflow)
  const saveStepDef = useAppStore((s) => s.saveStepDef)
  const deleteStepDef = useAppStore((s) => s.deleteStepDef)
  const resetWorkflows = useAppStore((s) => s.resetWorkflows)
  const providers = useAppStore((s) => s.providers)
  const { showToast } = useToast()
  const connectedProviders = useMemo(
    () => providers.filter((p) => p.connection === 'connected').map((p) => p.id),
    [providers],
  )

  const [editing, setEditing] = useState<Workflow | null | 'new'>(null)
  const [approved, setApproved] = useState(false)
  const [form, setForm] = useState<TemplateForm>(emptyForm())
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const [preview, setPreview] = useState<FormattedWorkflow | null>(null)

  // Both approved presets and drafts are listed; the card carries a status pill.
  // Autosave means every in-progress workflow is a real (often draft) record.
  const presets = templates.filter((t) => !t.deletedAt)

  // autosave plumbing: latest form/state captured in refs so a debounced timer
  // always flushes the newest snapshot without re-arming on every keystroke.
  const editingIdRef = useRef<WorkflowId | null>(null)
  const approvedRef = useRef(approved)
  approvedRef.current = approved
  const formRef = useRef(form)
  formRef.current = form
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // guards against overlapping saves (debounced flush + explicit flush racing
  // before the first INSERT resolves an id) producing a duplicate workflow.
  const isSavingRef = useRef(false)
  // skip the autosave that the open/load setForm would otherwise trigger
  const skipNextAutosave = useRef(true)
  const flushSaveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false))

  useEffect(() => {
    void loadPhaseTemplates(workspaceId)
    void loadStepLibrary(workspaceId)
  }, [loadPhaseTemplates, loadStepLibrary, workspaceId])

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    },
    [],
  )

  // Debounced autosave: any form edit while the composer is open flushes after a
  // short idle. The open/load setForm is skipped so it never re-saves on entry.
  useEffect(() => {
    if (editing === null) {
      return
    }
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    // Don't autosave a half-built form: a blank step name is a normal mid-edit
    // state (e.g. just-added blank step), not an error to surface. The hard
    // validation still fires on explicit approve/save. Re-arms once named.
    if (form.steps.some((d) => !d.name.trim())) {
      return
    }
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void flushSaveRef.current()
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editing])

  const openNew = () => {
    setEditing('new')
    setApproved(false)
    editingIdRef.current = null
    skipNextAutosave.current = true
    setForm(emptyForm())
    setExpandedIdx(0)
    setFormError(null)
  }

  const openEdit = (t: Workflow) => {
    setEditing(t)
    setApproved(t.isPreset !== false)
    editingIdRef.current = t.id
    skipNextAutosave.current = true
    setForm(templateToForm(t))
    setExpandedIdx(null)
    setFormError(null)
  }

  const closeEdit = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setEditing(null)
    editingIdRef.current = null
    setFormError(null)
  }

  const onFormat = async (description: string) => {
    const text = description.trim()
    if (text.length === 0) {
      return
    }
    const providerId = connectedProviders[0]
    if (!providerId) {
      showToast('error', 'connect a provider to format workflows')
      return
    }
    setFormatting(true)
    setFormError(null)
    try {
      const result = await formatWorkflowFromNL(
        { providerId, invokeFn: invoke },
        {
          description: text,
          currentName: form.name,
          currentDescription: form.description,
          currentStepNames: form.steps.map((s) => s.name).filter((n) => n.trim().length > 0),
        },
      )
      if (!result) {
        showToast('error', 'could not format workflow, try rephrasing')
        return
      }
      setPreview(result)
    } catch (err) {
      showToast('error', formatError(err))
    } finally {
      setFormatting(false)
    }
  }

  const applyPreview = () => {
    if (!preview) {
      return
    }
    setForm((prev) => ({
      name: prev.name.trim() || preview.name,
      description: prev.description.trim() || preview.description,
      goal: prev.goal.trim() || (preview.goal ?? ''),
      steps: preview.steps.map((s) => ({
        ...emptyDefinition(),
        role: s.role,
        name: s.name,
        promptPrefix: s.promptPrefix,
      })),
    }))
    setExpandedIdx(null)
    setPreview(null)
    setFormatOpen(false)
    showToast('success', 'workflow formatted')
  }

  const closeFormat = () => {
    setFormatOpen(false)
    setPreview(null)
  }

  // Flush the current form to disk. Returns false (and surfaces an error) when
  // the form is not yet saveable, so callers can decide whether to retry.
  const flushSave = async (): Promise<boolean> => {
    // In-flight guard: never let a second save start before the first resolves
    // its id, or both run with id=null and double-INSERT the same workflow.
    if (isSavingRef.current) {
      return false
    }
    const snapshot = formRef.current
    if (!snapshot.name.trim()) {
      setFormError('name is required')
      return false
    }
    if (snapshot.steps.some((d) => !d.name.trim())) {
      setFormError('all steps need a name')
      return false
    }

    const defs: WorkflowStepUpsertArgs[] = snapshot.steps.map((d, i) => ({
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
    }))

    const args: WorkflowUpsertArgs = {
      ...(editingIdRef.current ? { id: editingIdRef.current } : {}),
      workspaceId,
      name: snapshot.name.trim(),
      description: snapshot.description.trim(),
      ...(snapshot.goal.trim() ? { goal: snapshot.goal.trim() } : {}),
      steps: defs,
      isPreset: approvedRef.current,
    }

    isSavingRef.current = true
    setSaving(true)
    setFormError(null)
    try {
      const saved = await savePhaseTemplate(args)
      // savePhaseTemplate may resolve undefined under test mocks; guard the id read.
      const savedId = (saved as Workflow | undefined)?.id ?? null
      if (savedId) {
        editingIdRef.current = savedId
        setEditing((cur) => (cur && cur !== 'new' ? (saved as Workflow) : cur))
      }
      return true
    } catch (err) {
      setFormError(formatError(err))
      return false
    } finally {
      setSaving(false)
      isSavingRef.current = false
    }
  }
  flushSaveRef.current = flushSave

  const setApprovedAndSave = (next: boolean) => {
    // Cancel any pending debounced autosave so the immediate flush is the only
    // save — otherwise both can run with id=null and double-INSERT (mirror closeEdit).
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    setApproved(next)
    approvedRef.current = next
    void flushSave()
  }

  const onDelete = async (t: Workflow) => {
    await deleteWorkflow(t.id, workspaceId)
  }

  const onReset = async () => {
    setResetting(true)
    setFormError(null)
    try {
      await resetWorkflows(workspaceId)
      setEditing(null)
    } catch (err) {
      setFormError(formatError(err))
    } finally {
      setResetting(false)
      setConfirmReset(false)
    }
  }

  const activeId = editing !== null && editing !== 'new' ? editing.id : null

  const insertStep = (def: DefinitionForm, atIndex: number) => {
    setForm((prev) => {
      const steps = prev.steps.slice()
      const clamped = Math.max(0, Math.min(atIndex, steps.length))
      steps.splice(clamped, 0, def)
      return { ...prev, steps }
    })
  }

  const insertFromLibrary = (stepDefId: string, atIndex: number) => {
    const def = stepLibrary.find((s) => s.id === stepDefId)
    if (!def) {
      return
    }
    insertStep(defFromLibraryStep(def), atIndex)
  }

  const updateStep = (idx: number, patch: Partial<DefinitionForm>) => {
    setForm((prev) => {
      const steps = prev.steps.slice()
      steps[idx] = { ...steps[idx], ...patch } as DefinitionForm
      return { ...prev, steps }
    })
  }

  const removeStep = (idx: number) => {
    setForm((prev) => {
      const next = prev.steps.filter((_, i) => i !== idx)
      return { ...prev, steps: next.length > 0 ? next : [emptyDefinition()] }
    })
    setExpandedIdx(null)
  }

  const moveStep = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    setForm((prev) => {
      if (j < 0 || j >= prev.steps.length) {
        return prev
      }
      const steps = prev.steps.slice()
      ;[steps[idx], steps[j]] = [steps[j], steps[idx]] as [DefinitionForm, DefinitionForm]
      return { ...prev, steps }
    })
    setExpandedIdx((cur) => (cur === idx ? j : cur === j ? idx : cur))
  }

  const moveStepTo = (from: number, to: number) => {
    if (to === from || to === from + 1) {
      return
    }
    const insertAt = to > from ? to - 1 : to
    setForm((prev) => {
      const steps = prev.steps.slice()
      const [moved] = steps.splice(from, 1)
      steps.splice(insertAt, 0, moved as DefinitionForm)
      return { ...prev, steps }
    })
    setExpandedIdx((cur) => {
      if (cur === null) {
        return null
      }
      if (cur === from) {
        return insertAt
      }
      let c = cur > from ? cur - 1 : cur
      if (c >= insertAt) {
        c += 1
      }
      return c
    })
  }

  const { drag, dropIndex, startLibraryDrag, startStepDrag, ghost } = useWorkflowDrag({
    enabled: editing !== null,
    onDropLibrary: insertFromLibrary,
    onReorder: moveStepTo,
  })

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
        approved={approved}
        onToggleApproved={setApprovedAndSave}
        hasPresets={presets.length > 0}
        form={form}
        workspaceId={workspaceId}
        connectedProviders={connectedProviders}
        library={stepLibrary}
        expandedIdx={expandedIdx}
        saving={saving}
        error={formError}
        formatting={formatting}
        canFormat={connectedProviders.length > 0}
        onOpenFormat={() => setFormatOpen(true)}
        dragging={drag !== null}
        dropIndex={dropIndex}
        onNew={openNew}
        onChangeMeta={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onAddBlank={() => {
          insertStep(emptyDefinition(), form.steps.length)
          setExpandedIdx(form.steps.length)
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
        onClose={closeEdit}
      />

      <DragGhost ghost={ghost} />

      <WorkflowFormatPreview
        open={formatOpen}
        formatting={formatting}
        proposal={preview}
        currentStepNames={form.steps.map((s) => s.name)}
        onFormat={(description) => void onFormat(description)}
        onApply={applyPreview}
        onClose={closeFormat}
      />
    </div>
  )
}
