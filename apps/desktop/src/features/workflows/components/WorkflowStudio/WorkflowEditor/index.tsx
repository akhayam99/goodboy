import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Notice } from '@goodboy/ui';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import { modelOnProvider } from '../../../../providers/roleResolution';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { AnchoredConfirm } from '../../../../../shared/components/AnchoredConfirm';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ROLE_LABEL, classifyStep } from '../../../../session/agent-kind';
import { BuilderTitleField } from '../../WorkflowBuilderView/parts/BuilderTitleField';
import { GoalField } from '../../WorkflowBuilderView/parts/GoalField';
import { PlanDraftingBanner } from '../../WorkflowBuilderView/parts/PlanDraftingBanner';
import type { StepDraft } from '../../../engine';
import { addStep, blankStepDraft, duplicateStep, reorderSteps, updateStep } from '../../../engine';
import { useSaveAsStep } from '../../../hooks/useSaveAsStep';
import { useSavedSteps } from '../../../hooks/useSavedSteps';
import { useWorkflowDrag } from '../../../../../shared/hooks/useWorkflowDrag';
import { stepDraftFromSavedStep, type SavedStep } from '../../../savedSteps';
import { StepTree } from '../../StepTree';
import { StepEditor } from '../../StepTree/StepEditor';
import { StepRow } from '../../StepTree/StepRow';
import type { useWorkflowEditor } from '../../WorkflowsPanel/useWorkflowEditor';
import { usePolish } from '../../../hooks/usePolish';
import { useProsePolishDeps } from '../../../hooks/useProsePolishDeps';
import { useStepDeleteUndo } from '../../../hooks/useStepDeleteUndo';
import { stepPolishFields } from '../../../stepPolishFields';
import { polishWorkflowGoalText } from '../../../workflows';
import { DragGhost } from '../DragGhost';
import { roleSetLine } from '../../../roleSetLine';
import { EditorTrail } from './EditorTrail';
import { NoProvidersNotice } from './NoProvidersNotice';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workingDir: string | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly editor: ReturnType<typeof useWorkflowEditor>;
};

const IDENTITY_INDEX = 0;

export const WorkflowEditor = ({ workspaceId, workingDir, connectedProviders, editor }: Props) => {
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const roleModels = overrides?.roleModels ?? null;
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
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
  const setGoal = (goal: string) => setForm((current) => ({ ...current, goal }));
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

  const hasGoal = form.goal.trim().length > 0;
  const draftLabel = steps.length === 0 ? 'Draft steps' : 'Redraft steps';
  const draftAction = (
    <Button
      variant="ghost"
      size="sm"
      disabled={blocked || !hasProviders || !hasGoal}
      title={
        !hasProviders
          ? 'Connect a provider to draft steps'
          : !hasGoal
            ? 'Write a goal first'
            : undefined
      }
      onClick={() => void editor.draftSteps()}
    >
      <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
      {draftLabel}
    </Button>
  );

  const banner = blocked && steps.length > 0 ? <PlanDraftingBanner /> : null;

  const error = editor.formError ?? editor.generationError ?? polishError ?? saveError;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="relative flex flex-col gap-3">
        <EditorTrail
          name={form.name}
          saveStatus={editor.saveStatus}
          isSavedWorkflow={editor.isSavedWorkflow}
          isDirty={editor.isDirty}
          disabled={blocked}
          onBack={editor.close}
          onDuplicate={() => void editor.duplicate()}
          onUndo={editor.undoSinceOpened}
          onDelete={() => {
            if (editor.isSavedWorkflow) {
              void editor.remove();
              return;
            }
            setIsConfirmingDiscard(true);
          }}
        />
        <AnchoredConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Discard this workflow?"
          description="Nothing is saved yet. The draft is lost."
          confirmLabel="Discard"
          isOpen={isConfirmingDiscard}
          onConfirm={async () => {
            await editor.remove();
            setIsConfirmingDiscard(false);
          }}
          onCancel={() => setIsConfirmingDiscard(false)}
        />
      </div>
      <div className="flex flex-col gap-3">
        <BuilderTitleField
          value={form.name}
          placeholder="Untitled workflow"
          suggestion={null}
          disabled={blocked}
          onChange={(name) => setForm((current) => ({ ...current, name }))}
          onAcceptSuggestion={() => {}}
        />
        <GoalField
          value={form.goal}
          placeholder="what should this workflow accomplish? Draft steps writes the plan from it…"
          hasSessionGoal={false}
          isSessionGoal={false}
          canUndo={polish.canUndo({ id: 'goal', current: form.goal })}
          isPolishing={polish.polishingId === 'goal'}
          disabled={blocked}
          onChange={setGoal}
          onBlur={() => {}}
          onUseSessionGoal={() => {}}
          onUndo={() => polish.undo({ id: 'goal', current: form.goal, apply: setGoal })}
          onPolish={() =>
            void polish.run({
              id: 'goal',
              current: form.goal,
              keptMessage: 'Kept your wording. The goal could not be polished.',
              polish: () => polishWorkflowGoalText({ deps: polishDeps, goal: form.goal }),
              apply: setGoal,
            })
          }
        />
      </div>
      {hasProviders ? null : <NoProvidersNotice />}
      {error === null ? null : (
        <Notice tone="danger" placement="inline" role="alert" title={error} />
      )}
      <StepTree
        steps={steps}
        editedCount={editor.editedKeys.size}
        identityIndex={IDENTITY_INDEX}
        isPlanning={blocked}
        isDragging={drag !== null}
        dropIndex={dropIndex}
        disabled={blocked}
        banner={banner}
        action={draftAction}
        savedSteps={savedSteps}
        onAddStep={insertStep}
        renderStep={({ step, index, span }) => {
          const effort = step.effort;
          return (
            <StepRow
              key={step.key}
              step={step}
              ordinal={index + 1}
              kind={classifyStep({ step })}
              provider={resolvedProvider(step)}
              model={resolvedModel(step)}
              effort={effort}
              estimate={undefined}
              span={span}
              identityIndex={IDENTITY_INDEX}
              isExpanded={expandedKey === step.key}
              isEdited={editor.editedKeys.has(step.key)}
              isPinned={step.provider !== '' || step.model !== ''}
              isDragging={draggingKey === step.key}
              disabled={blocked}
              onToggle={() => setExpandedKey(expandedKey === step.key ? null : step.key)}
              onStartDrag={(event) =>
                startStepDrag(index, step.name.trim() || ROLE_LABEL[step.role], event)
              }
              onMoveUp={() => moveStep(step.key, -1)}
              onMoveDown={() => moveStep(step.key, 1)}
              editor={
                <StepEditor
                  step={step}
                  ordinal={index + 1}
                  stepCount={steps.length}
                  effort={effort}
                  recommendedProvider={defaultProvider}
                  recommendedModel={recommendedModel(step)}
                  connectedProviders={connectedProviders}
                  isRoutingOverridden={step.provider !== '' || step.model !== ''}
                  roleSetLine={roleSetLine({ role: step.role, roleModels })}
                  disabled={blocked}
                  polish={stepPolishFields({
                    polish,
                    deps: polishDeps,
                    goal: form.goal,
                    step,
                    patchStep,
                  })}
                  onName={(name) => patchStep(step.key, { name })}
                  onRole={(role) => patchStep(step.key, { role })}
                  onPrompt={(prompt) => patchStep(step.key, { prompt })}
                  onExpectedOutput={(expectedOutput) => patchStep(step.key, { expectedOutput })}
                  onRoute={(route) => patchStep(step.key, route)}
                  onVerbosity={(verbosity) => patchStep(step.key, { verbosity })}
                  onRoutingReset={() => patchStep(step.key, { provider: '', model: '' })}
                  onPin={() =>
                    patchStep(step.key, {
                      provider: resolvedProvider(step),
                      model: resolvedModel(step),
                    })
                  }
                  onMoveUp={() => moveStep(step.key, -1)}
                  onMoveDown={() => moveStep(step.key, 1)}
                  onDuplicate={() =>
                    setSteps((current) => duplicateStep({ steps: current, key: step.key }))
                  }
                  isSavingAsStep={savingKey === step.key}
                  onSaveAsStep={() => {
                    setSaveError(null);
                    void saveAsStep(step);
                  }}
                  onDelete={() => deleteStep(step.key)}
                  onDone={() => setExpandedKey(null)}
                />
              }
            />
          );
        }}
      />
      <DragGhost ghost={ghost} />
    </div>
  );
};
