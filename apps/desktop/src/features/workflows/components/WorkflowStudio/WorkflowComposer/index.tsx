import { Fragment } from 'react';
import { Button, Divider, Input, SectionHeader } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import { ScrollFade } from '../../../../../shared/components/ScrollFade';
import type { StepDefUpsertArgs } from '../../../workflows';
import type { DefinitionForm, TemplateForm } from '../../../form';
import { StepFlowCard } from '../StepFlowCard';
import { StepFlowConnector } from '../StepFlowConnector';
import { StepEditor } from '../StepEditor';
import { StepLibraryPalette } from '../StepLibraryPalette';
import { EmptyGuide } from '../EmptyGuide';

type Props = {
  readonly open: boolean;
  readonly isNew: boolean;
  readonly hasPresets: boolean;
  readonly form: TemplateForm;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly library: ReadonlyArray<StepDef>;
  readonly expandedIdx: number | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly dragging: boolean;
  readonly dropIndex: number | null;
  readonly onNew: () => void;
  readonly onChangeMeta: (patch: Partial<Pick<TemplateForm, 'name' | 'description'>>) => void;
  readonly onAddBlank: () => void;
  readonly onToggleExpand: (idx: number) => void;
  readonly onUpdateStep: (idx: number, patch: Partial<DefinitionForm>) => void;
  readonly onRemoveStep: (idx: number) => void;
  readonly onMoveStep: (idx: number, dir: -1 | 1) => void;
  readonly draggingStepIdx: number | null;
  readonly onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  readonly onStartStepDrag: (fromIndex: number, label: string, e: React.PointerEvent) => void;
  readonly onSaveDef: (args: StepDefUpsertArgs) => void;
  readonly onDeleteDef: (id: StepDefId) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export function WorkflowComposer({
  open,
  isNew,
  hasPresets,
  form,
  workspaceId,
  connectedProviders,
  library,
  expandedIdx,
  saving,
  error,
  dragging,
  dropIndex,
  onNew,
  onChangeMeta,
  onAddBlank,
  onToggleExpand,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  draggingStepIdx,
  onStartDrag,
  onStartStepDrag,
  onSaveDef,
  onDeleteDef,
  onSave,
  onCancel,
}: Props) {
  if (!open) {
    return (
      <section className="flex min-w-0 flex-1 flex-col">
        <EmptyGuide onNew={onNew} hasPresets={hasPresets} />
      </section>
    );
  }

  const stepCount = form.steps.length;
  const title = form.name.trim() || (isNew ? 'New workflow' : 'Untitled workflow');
  const subtitle = [`${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`, form.description.trim()]
    .filter(Boolean)
    .join('  ·  ');
  const selectedStep =
    expandedIdx !== null && expandedIdx >= 0 && expandedIdx < stepCount
      ? form.steps[expandedIdx]
      : null;

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 px-8 py-4">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-foreground">{title}</span>
          <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {error ? <span className="text-2xs font-medium text-danger">{error}</span> : null}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save workflow'}
          </Button>
        </div>
      </div>

      <Divider />

      <div className="flex shrink-0 flex-col gap-6 py-6">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 px-10 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              name
            </label>
            <Input
              value={form.name}
              onChange={(e) => onChangeMeta({ name: e.target.value })}
              placeholder="e.g. plan-implement-review"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              description
            </label>
            <Input
              value={form.description}
              onChange={(e) => onChangeMeta({ description: e.target.value })}
              placeholder="what this workflow is for"
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-10">
          <SectionHeader
            label={`Steps (${stepCount})`}
            hint={
              dragging
                ? 'Drop the step between two cards.'
                : 'Runs left to right. Add a blank step or drag one up from the library.'
            }
            action={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                onClick={onAddBlank}
              >
                <Plus size={11} aria-hidden /> blank step
              </button>
            }
          />
        </div>

        <ScrollFade orientation="horizontal" className="mx-auto w-full max-w-6xl pb-2">
          <div className="flex w-max items-stretch px-10 py-1">
            {form.steps.map((def, idx) => (
              <Fragment key={idx}>
                <StepFlowConnector
                  index={idx}
                  interior={idx > 0}
                  dragging={dragging}
                  active={dropIndex === idx}
                />
                <StepFlowCard
                  def={def}
                  ordinal={idx}
                  total={stepCount}
                  selected={expandedIdx === idx}
                  isDragging={draggingStepIdx === idx}
                  connectedProviders={connectedProviders}
                  onSelect={() => onToggleExpand(idx)}
                  onStartDrag={(e) => onStartStepDrag(idx, def.name || 'untitled step', e)}
                  onRemove={() => onRemoveStep(idx)}
                  onMoveLeft={() => onMoveStep(idx, -1)}
                  onMoveRight={() => onMoveStep(idx, 1)}
                />
              </Fragment>
            ))}
            <StepFlowConnector
              index={stepCount}
              interior={false}
              dragging={dragging}
              active={dropIndex === stepCount}
            />
          </div>
        </ScrollFade>
      </div>

      <Divider />

      <div className="min-h-0 flex-1">
        <ScrollFade className="mx-auto h-full max-w-3xl px-10 py-6">
          <div className="flex flex-col gap-6">
            {selectedStep ? (
              <>
                <StepEditor
                  def={selectedStep}
                  ordinal={expandedIdx as number}
                  connectedProviders={connectedProviders}
                  onUpdate={(patch) => onUpdateStep(expandedIdx as number, patch)}
                  onClose={() => onToggleExpand(expandedIdx as number)}
                />
                <Divider />
              </>
            ) : null}

            <StepLibraryPalette
              library={library}
              workspaceId={workspaceId}
              connectedProviders={connectedProviders}
              onStartDrag={onStartDrag}
              onSaveDef={onSaveDef}
              onDeleteDef={onDeleteDef}
            />
          </div>
        </ScrollFade>
      </div>
    </section>
  );
}
