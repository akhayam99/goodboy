import { Fragment, useState } from 'react';
import { Button, Divider, FieldRow, Input, SectionHeader, Textarea } from '@goodboy/ui';
import { Plus, Sparkles } from 'lucide-react';
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
  readonly isApproved: boolean;
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
  readonly onFormat: (description: string) => void;
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
  readonly onSave: (isPreset: boolean) => void;
  readonly onCancel: () => void;
};

export const WorkflowComposer = ({
  open,
  isNew,
  isApproved,
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
  onFormat,
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
}: Props) => {
  const [magicOpen, setMagicOpen] = useState(false);
  const [magicText, setMagicText] = useState('');

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
      <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center gap-3 px-8 py-4">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 truncate text-base font-semibold text-foreground">
            {title}
            {!isApproved ? (
              <span className="shrink-0 rounded bg-warning/15 px-1.5 py-px text-[10px] font-semibold uppercase leading-none tracking-wide text-warning">
                draft
              </span>
            ) : null}
          </span>
          <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {error ? <span className="text-2xs font-medium text-danger">{error}</span> : null}
          {canFormat ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMagicOpen((v) => !v)}
                disabled={saving || formatting}
              >
                <Sparkles size={13} aria-hidden className="mr-1" />
                {formatting ? 'Formatting…' : 'Format with AI'}
              </Button>
              <span className="h-4 w-px bg-border-soft" aria-hidden />
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onSave(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save as draft'}
          </Button>
          <Button size="sm" onClick={() => onSave(true)} disabled={saving}>
            {saving ? 'Saving…' : 'Approve & save'}
          </Button>
        </div>
      </div>

      <Divider />

      <div className="flex shrink-0 flex-col gap-6 py-6">
        <div className="mx-auto w-full max-w-4xl divide-y divide-border-soft/50 px-8">
          <FieldRow label="Name">
            <Input
              value={form.name}
              onChange={(e) => onChangeMeta({ name: e.target.value })}
              placeholder="e.g. plan-implement-review"
              className="sm:w-80"
            />
          </FieldRow>
          <FieldRow label="Description" help="What this workflow is for.">
            <Input
              value={form.description}
              onChange={(e) => onChangeMeta({ description: e.target.value })}
              placeholder="short summary"
              className="sm:w-80"
            />
          </FieldRow>
        </div>

        {magicOpen && canFormat ? (
          <div className="mx-auto w-full max-w-4xl px-8">
            <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-4">
              <label className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                describe the workflow
              </label>
              <Textarea
                value={magicText}
                onChange={(e) => setMagicText(e.target.value)}
                rows={3}
                placeholder="e.g. plan the change, implement it carefully, then run tests and review the diff"
                disabled={formatting}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMagicOpen(false)}
                  disabled={formatting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onFormat(magicText);
                    setMagicText('');
                    setMagicOpen(false);
                  }}
                  disabled={formatting || magicText.trim().length === 0}
                >
                  <Sparkles size={13} aria-hidden className="mr-1" />
                  {formatting ? 'Formatting…' : 'Format'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto w-full max-w-4xl px-8">
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

        <ScrollFade orientation="horizontal" className="mx-auto w-full max-w-4xl pb-2">
          <div className="flex w-max items-stretch px-8 py-1">
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
        <ScrollFade className="mx-auto h-full max-w-4xl px-8 py-6">
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
};
