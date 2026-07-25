import { Fragment } from 'react';
import { Button, Divider, FieldRow, Input, SectionHeader, ScrollFade, cn } from '@goodboy/ui';
import { Check, Plus, Sparkles, X } from 'lucide-react';
import { recommendedModelForRole } from '@goodboy/core';
import type { ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import type { StepDefUpsertArgs } from '../../../workflows';
import type { DefinitionForm, TemplateForm } from '../../../form';
import { ROLE_TO_KIND } from '../../../../session/agent-kind';
import { WorkflowStepCard } from '../../../../session/components/WorkflowStepCard';
import { StepFlowConnector } from '../StepFlowConnector';
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
  const savedHint = saving ? 'Saving…' : 'Saved';

  const defaultProvider: ProviderId =
    connectedProviders.length > 0 ? (connectedProviders[0] as ProviderId) : 'anthropic';

  const recommendedProvider = (_def: DefinitionForm): ProviderId => defaultProvider;

  const resolvedProvider = (def: DefinitionForm): ProviderId =>
    def.providerOverride !== undefined && def.providerOverride !== ''
      ? (def.providerOverride as ProviderId)
      : recommendedProvider(def);

  const recommendedModel = (def: DefinitionForm): string =>
    recommendedModelForRole({ role: def.role, provider: resolvedProvider(def) });

  const resolvedModel = (def: DefinitionForm): string =>
    def.modelOverride !== undefined && def.modelOverride !== ''
      ? def.modelOverride
      : recommendedModel(def);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-4 px-6 py-4">
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

        <div className="flex shrink-0 flex-col gap-5 py-5">
          <div className="mx-auto w-full max-w-2xl px-6">
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

          <div className="mx-auto w-full max-w-2xl px-6">
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
          <ScrollFade
            className="mx-auto h-full w-full max-w-2xl"
            viewportClassName="px-6 pb-6"
            fadeSize={24}
          >
            <ul className="flex flex-col list-none p-0">
              {form.steps.map((def, idx) => (
                <Fragment key={def.uid}>
                  <StepFlowConnector
                    index={idx}
                    interior={idx > 0}
                    dragging={dragging}
                    active={dropIndex === idx}
                  />
                  <WorkflowStepCard
                    ordinal={idx}
                    kind={ROLE_TO_KIND[def.role] ?? 'generic'}
                    role={def.role}
                    provider={resolvedProvider(def)}
                    providerValue={def.providerOverride as ProviderId | ''}
                    recommendedProvider={recommendedProvider(def)}
                    candidateProviders={connectedProviders}
                    name={def.name}
                    promptPrefix={def.promptPrefix}
                    expectedOutput={def.expectedOutput}
                    model={def.modelOverride}
                    resolvedModel={resolvedModel(def)}
                    recommendedModel={recommendedModel(def)}
                    effort={def.effort}
                    verbosity={def.verbosity}
                    expanded={expandedIdx === idx}
                    dragging={draggingStepIdx === idx}
                    disabled={false}
                    polishing={false}
                    onExpand={() => onToggleExpand(idx)}
                    onCollapse={() => onToggleExpand(idx)}
                    onStartDrag={(e) => onStartStepDrag(idx, def.name || 'untitled step', e)}
                    onName={(v) => onUpdateStep(idx, { name: v })}
                    onPrompt={(v) => onUpdateStep(idx, { promptPrefix: v })}
                    onExpectedOutput={(v) => onUpdateStep(idx, { expectedOutput: v })}
                    onProvider={(v) => onUpdateStep(idx, { providerOverride: v })}
                    onModel={(v) => onUpdateStep(idx, { modelOverride: v })}
                    onEffort={(v) => onUpdateStep(idx, { effort: v })}
                    onRole={(v) => onUpdateStep(idx, { role: v })}
                    onVerbosity={(v) => onUpdateStep(idx, { verbosity: v })}
                    onRemove={() => onRemoveStep(idx)}
                    onMoveUp={() => onMoveStep(idx, -1)}
                    onMoveDown={() => onMoveStep(idx, 1)}
                  />
                </Fragment>
              ))}
              <StepFlowConnector
                index={stepCount}
                interior={false}
                dragging={dragging}
                active={dropIndex === stepCount}
              />
            </ul>
          </ScrollFade>
        </div>
      </section>

      <Divider orientation="vertical" />

      <aside className="flex w-64 shrink-0 flex-col">
        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-4" fadeSize={24}>
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
