import { useState } from 'react';
import { Button, ICON_SIZE, Notice, PaneShell, PaneTitleRow } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core/providers';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import { BuilderTitleField } from './BuilderTitleField';
import { CreateActions } from './CreateActions';
import { GuideFields } from './GuideFields';
import { KeepOrderField } from './KeepOrderField';
import { WorkflowModels } from './WorkflowModels';
import { modelOnProvider } from '../../../../providers/roleResolution';
import { WorkflowStepRow } from './WorkflowStepRow';
import { PlanDraftingBanner } from './PlanDraftingBanner';
import type { StepDraft, WorkflowDraft } from '../../../engine';
import { addStep, blankStepDraft, duplicateStep, reorderSteps, updateStep } from '../../../engine';
import { useSaveAsStep } from '../../../hooks/useSaveAsStep';
import { useSavedSteps } from '../../../hooks/useSavedSteps';
import { useWorkflowDrag } from '../../../../../shared/hooks/useWorkflowDrag';
import { stepDraftFromSavedStep, type SavedStep } from '../../../savedSteps';
import { StepTree } from '../../StepTree';
import type { useWorkflowEditor } from '../../WorkflowsPanel/useWorkflowEditor';
import { usePolish } from '../../../hooks/usePolish';
import { useProsePolishDeps } from '../../../hooks/useProsePolishDeps';
import { useStepDeleteUndo } from '../../../hooks/useStepDeleteUndo';
import { stepPolishFields } from '../../../stepPolishFields';
import { DragGhost } from '../DragGhost';
import { EditorLead } from './EditorLead';
import { NoProvidersNotice } from './NoProvidersNotice';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly editor: ReturnType<typeof useWorkflowEditor>;
};

const IDENTITY_INDEX = 0;

export const WorkflowEditor = ({
  workspaceId,
  workingDir,
  connectedProviders,
  workflows,
  editor,
}: Props) => {
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const roleModels = overrides?.roleModels ?? null;
  const { form, setForm, expandedKey, setExpandedKey } = editor;
  const steps = form.steps;
  const polishDeps = useProsePolishDeps({ workspaceId, workingDir });
  const [polishError, setPolishError] = useState<string | null>(null);
  const polish = usePolish({ onError: setPolishError });
  const blocked = editor.isGenerating;
  const hasProviders = connectedProviders.length > 0;
  const defaultProvider: ProviderId =
    overrides?.defaultProviderId ??
    connectedProviders[0] ??
    DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;

  const setSteps = (next: (current: ReadonlyArray<StepDraft>) => ReadonlyArray<StepDraft>) =>
    setForm((current) => ({ ...current, steps: next(current.steps) }));
  const patchStep = (key: string, patch: Partial<StepDraft>) =>
    setSteps((current) => updateStep({ steps: current, key, patch }));
  const moveStep = (key: string, direction: -1 | 1) =>
    setSteps((current) => {
      const from = current.findIndex((step) => step.key === key);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= current.length) {
        return current;
      }
      return reorderSteps({ steps: current, from, to: to + (direction > 0 ? 1 : 0) });
    });
  const moveStepTo = (from: number, to: number) => {
    if (to === from || to === from + 1) {
      return;
    }
    setSteps((current) => reorderSteps({ steps: current, from, to }));
  };
  const savedSteps = useSavedSteps({ workspaceId });
  const deleteStep = useStepDeleteUndo({
    steps,
    setSteps,
    contextKey: editor.contextKey,
    onDeleted: (key) => setExpandedKey(expandedKey === key ? null : expandedKey),
  });
  const setField = (patch: Partial<WorkflowDraft>) =>
    setForm((current) => ({ ...current, ...patch }));
  const insertStep = (picked: SavedStep | null) => {
    const step = picked === null ? blankStepDraft() : stepDraftFromSavedStep({ step: picked });
    setSteps((current) => addStep({ steps: current, step }));
    setExpandedKey(step.key);
  };
  const [saveError, setSaveError] = useState<string | null>(null);
  const { savingKey, saveAsStep } = useSaveAsStep({
    workspaceId,
    onLinked: (key, libraryStepId) => patchStep(key, { libraryStepId }),
    onError: (message) => setSaveError(`Couldn't save the step. ${message}`),
  });

  const { drag, dropIndex, startStepDrag, ghost } = useWorkflowDrag({
    enabled: steps.length > 0,
    onReorder: moveStepTo,
  });
  const draggingKey = drag?.kind === 'step' ? (steps[drag.fromIndex]?.key ?? null) : null;

  const resolvedProvider = (step: StepDraft): ProviderId =>
    step.provider !== '' ? step.provider : defaultProvider;
  const recommendedModel = (step: StepDraft): string =>
    modelOnProvider({
      role: step.role,
      provider: resolvedProvider(step),
      roleModels,
      size: step.size,
    });
  const resolvedModel = (step: StepDraft): string =>
    step.model !== '' ? step.model : recommendedModel(step);

  const hasPurpose = form.description.trim().length > 0 || form.entryCheck.trim().length > 0;
  const isDraftOff = blocked || !hasProviders || !hasPurpose;
  const draftHint = !hasProviders
    ? 'Connect a provider to draft steps'
    : !hasPurpose
      ? 'Say when to use it first'
      : undefined;
  const draftLabel = steps.length === 0 ? 'Draft steps' : 'Redraft steps';
  const draftAction = (
    <Button
      variant="ghost"
      size="sm"
      disabled={isDraftOff}
      title={draftHint}
      onClick={() => void editor.draftSteps()}
    >
      <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
      {draftLabel}
    </Button>
  );

  const banner = blocked && steps.length > 0 ? <PlanDraftingBanner /> : null;

  const error = editor.formError ?? editor.generationError ?? polishError ?? saveError;
  const isNew = !editor.isSavedWorkflow;
  const isLocked = blocked || editor.isCreating;
  const errorNotice =
    error === null ? null : <Notice tone="danger" placement="inline" role="alert" title={error} />;

  return (
    <PaneShell
      page="workflows"
      lead={<EditorLead editor={editor} isDisabled={blocked} />}
      header={
        isNew ? (
          <PaneTitleRow title="New workflow" />
        ) : (
          <BuilderTitleField
            value={form.name}
            placeholder="Untitled workflow"
            suggestion={null}
            disabled={blocked}
            onChange={(name) => setField({ name })}
            onAcceptSuggestion={() => {}}
          />
        )
      }
    >
      <GuideFields
        workspaceId={workspaceId}
        workingDir={workingDir}
        form={form}
        workflows={workflows}
        selfId={editor.editingId}
        isNew={isNew}
        nameError={editor.nameError}
        isLocked={isLocked}
        onChange={setField}
      />
      {hasProviders ? null : <NoProvidersNotice />}
      {isNew ? null : errorNotice}
      <StepTree
        steps={steps}
        editedCount={editor.editedKeys.size}
        identityIndex={IDENTITY_INDEX}
        isPlanning={blocked}
        isDragging={drag !== null}
        dropIndex={dropIndex}
        disabled={isLocked}
        banner={banner}
        action={draftAction}
        savedSteps={savedSteps}
        onAddStep={insertStep}
        renderStep={({ step, index, span }) => {
          const isOpen = expandedKey === step.key;
          return (
            <WorkflowStepRow
              key={step.key}
              step={step}
              index={index}
              span={span}
              stepCount={steps.length}
              defaultProvider={defaultProvider}
              provider={resolvedProvider(step)}
              model={resolvedModel(step)}
              recommendedModel={recommendedModel(step)}
              roleModels={roleModels}
              connectedProviders={connectedProviders}
              polish={stepPolishFields({
                polish,
                deps: polishDeps,
                goal: form.description,
                step,
                patchStep,
              })}
              isLocked={isLocked}
              isExpanded={isOpen}
              isEdited={editor.editedKeys.has(step.key)}
              isDragging={draggingKey === step.key}
              isSaving={savingKey === step.key}
              onToggle={() => setExpandedKey(isOpen ? null : step.key)}
              onStartDrag={(event) =>
                startStepDrag(index, step.name.trim() || ROLE_LABEL[step.role], event)
              }
              onPatch={(patch) => patchStep(step.key, patch)}
              onMove={(direction) => moveStep(step.key, direction)}
              onDuplicate={() =>
                setSteps((current) => duplicateStep({ steps: current, key: step.key }))
              }
              onSaveAsStep={() => {
                setSaveError(null);
                void saveAsStep(step);
              }}
              onDelete={() => deleteStep(step.key)}
              onDone={() => setExpandedKey(null)}
            />
          );
        }}
      />
      <KeepOrderField
        isOrderKept={form.isOrderKept}
        isDisabled={isLocked}
        onChange={(isOrderKept) => setField({ isOrderKept })}
      />
      <WorkflowModels
        workspaceId={workspaceId}
        steps={steps}
        connectedProviders={connectedProviders}
        isCollapsed={isNew}
        isDisabled={isLocked}
        onSteps={setSteps}
      />
      {isNew ? errorNotice : null}
      {isNew ? (
        <CreateActions
          reason={editor.isCreating ? null : editor.createReason}
          error={editor.formError}
          isCreating={editor.isCreating}
          isDisabled={isLocked || editor.createReason !== null || editor.nameError !== null}
          onDiscard={editor.discard}
          onCreate={() => void editor.create()}
        />
      ) : null}
      <DragGhost ghost={ghost} />
    </PaneShell>
  );
};
