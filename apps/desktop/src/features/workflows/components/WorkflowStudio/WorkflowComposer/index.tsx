import { Fragment } from 'react';
import { Button, Divider, FieldRow, Input, SectionHeader, cn } from '@goodboy/ui';
import { Check, Plus, Sparkles, X } from 'lucide-react';
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
  readonly approved: boolean;
  readonly onToggleApproved: (next: boolean) => void;
  readonly hasPresets: boolean;
  readonly form: TemplateForm;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly library: ReadonlyArray<StepDef>;
  readonly expandedIdx: number | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly formatting: boolean;
  readonly canFormat: boolean;
  readonly onOpenFormat: () => void;
  readonly dragging: boolean;
  readonly dropIndex: number | null;
  readonly onNew: () => void;
  readonly onChangeMeta: (
    patch: Partial<Pick<TemplateForm, 'name' | 'description' | 'goal'>>,
  ) => void;
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
  readonly onClose: () => void;
};

export const WorkflowComposer = ({
  open,
  isNew,
  approved,
  onToggleApproved,
  hasPresets,
  form,
  workspaceId,
  connectedProviders,
  library,
  expandedIdx,
  saving,
  error,
  formatting,
  canFormat,
  onOpenFormat,
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
  onClose,
}: Props) => {
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

  const savedHint = saving ? 'Saving…' : 'Saved';

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center gap-4 px-8 py-4">
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 truncate text-base font-semibold text-foreground">
              {title}
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-px text-2xs font-semibold uppercase leading-none tracking-eyebrow',
                  approved ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
                )}
              >
                {approved ? 'approved' : 'draft'}
              </span>
            </span>
            <span className="truncate text-2xs text-muted-foreground">
              {error ? <span className="font-medium text-danger">{error}</span> : subtitle}
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span
              className="text-2xs text-muted-foreground/60 tabular-nums"
              aria-live="polite"
              role="status"
            >
              {savedHint}
            </span>
            {canFormat ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenFormat}
                disabled={saving || formatting}
              >
                <Sparkles size={13} aria-hidden />
                {formatting ? 'Formatting…' : 'Format with AI'}
              </Button>
            ) : null}
            <Button
              variant={approved ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => onToggleApproved(!approved)}
              disabled={saving}
            >
              <Check size={13} aria-hidden />
              {approved ? 'Move to draft' : 'Approve'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="close workflow editor">
              <X size={13} aria-hidden />
              Close
            </Button>
          </div>
        </div>

        <Divider />

        <div className="flex shrink-0 flex-col gap-4 py-6">
          <div className="mx-auto w-full max-w-3xl px-8">
            <div className="flex flex-col gap-4">
              <FieldRow label="Name">
                <Input
                  value={form.name}
                  onChange={(e) => onChangeMeta({ name: e.target.value })}
                  placeholder="e.g. plan-implement-review"
                  className="sm:w-80"
                />
              </FieldRow>
              <Divider />
              <FieldRow label="Description" help="What this workflow is for.">
                <Input
                  value={form.description}
                  onChange={(e) => onChangeMeta({ description: e.target.value })}
                  placeholder="short summary"
                  className="sm:w-80"
                />
              </FieldRow>
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl px-8">
            <SectionHeader
              label={`Steps (${stepCount})`}
              hint={
                dragging
                  ? 'Drop the step between two cards.'
                  : 'Runs top to bottom, in order. Add a blank step or drag one in from the library.'
              }
              action={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                  onClick={onAddBlank}
                >
                  <Plus size={11} aria-hidden /> blank step
                </button>
              }
            />
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <ScrollFade className="mx-auto h-full w-full max-w-3xl px-8 pb-6">
            <div className="flex flex-col">
              {form.steps.map((def, idx) => (
                <Fragment key={def.uid}>
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
                    onSelect={() => onToggleExpand(idx)}
                    onStartDrag={(e) => onStartStepDrag(idx, def.name || 'untitled step', e)}
                    onRemove={() => onRemoveStep(idx)}
                    onMoveLeft={() => onMoveStep(idx, -1)}
                    onMoveRight={() => onMoveStep(idx, 1)}
                    editor={
                      expandedIdx === idx && selectedStep ? (
                        <StepEditor
                          def={selectedStep}
                          connectedProviders={connectedProviders}
                          onUpdate={(patch) => onUpdateStep(idx, patch)}
                        />
                      ) : null
                    }
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
      </section>

      <Divider orientation="vertical" />

      <aside className="flex w-64 shrink-0 flex-col">
        <ScrollFade className="min-h-0 flex-1 px-3 py-4">
          <StepLibraryPalette
            library={library}
            workspaceId={workspaceId}
            connectedProviders={connectedProviders}
            onStartDrag={onStartDrag}
            onSaveDef={onSaveDef}
            onDeleteDef={onDeleteDef}
          />
        </ScrollFade>
      </aside>
    </div>
  );
};
