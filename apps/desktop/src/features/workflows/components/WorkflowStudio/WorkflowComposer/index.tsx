import { Fragment, useState } from 'react';
import { Divider, Input, SectionHeader, ScrollFade } from '@goodboy/ui';
import { Library, Plus, X } from 'lucide-react';
import { recommendedModelForRole } from '@goodboy/core';
import type { ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import type { StepDefUpsertArgs } from '../../../workflows';
import type { DefinitionForm, TemplateForm } from '../../../form';
import { clampEffort } from '../../../../chat/utils/chat-constants';
import { ROLE_TO_KIND } from '../../../../session/agent-kind';
import { WorkflowStepCard } from '../../../../session/components/WorkflowStepCard';
import { StepFlowConnector } from '../StepFlowConnector';
import { StepLibraryPalette } from '../StepLibraryPalette';
import { useAppStore } from '../../../../../store';
import { WorkflowHeaderActions } from './WorkflowHeaderActions';

type Props = {
  readonly form: TemplateForm;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly library: ReadonlyArray<StepDef>;
  readonly expandedIdx: number | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly dragging: boolean;
  readonly dropIndex: number | null;
  readonly isNew: boolean;
  readonly generating: boolean;
  readonly canGenerate: boolean;
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
  readonly onAddLibraryStep: (def: StepDef) => void;
  readonly onStartStepDrag: (fromIndex: number, label: string, e: React.PointerEvent) => void;
  readonly onSaveDef: (args: StepDefUpsertArgs) => void;
  readonly onDeleteDef: (id: StepDefId) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
  readonly onGenerate: () => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
};

export const WorkflowComposer = ({
  form,
  workspaceId,
  connectedProviders,
  library,
  expandedIdx,
  saving,
  error,
  dragging,
  dropIndex,
  isNew,
  generating,
  canGenerate,
  onChangeMeta,
  onAddBlank,
  onToggleExpand,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  draggingStepIdx,
  onStartDrag,
  onAddLibraryStep,
  onStartStepDrag,
  onSaveDef,
  onDeleteDef,
  onDuplicate,
  onDelete,
  onGenerate,
  onReset,
  onClose,
}: Props) => {
  const roleModels = useAppStore((s) => s.workspaceOverrides?.[workspaceId]?.roleModels ?? null);
  const stepCount = form.steps.length;
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const defaultProvider: ProviderId =
    connectedProviders.length > 0 ? (connectedProviders[0] as ProviderId) : 'anthropic';

  const recommendedProvider = (_def: DefinitionForm): ProviderId => defaultProvider;

  const resolvedProvider = (def: DefinitionForm): ProviderId =>
    def.providerOverride !== undefined && def.providerOverride !== ''
      ? (def.providerOverride as ProviderId)
      : recommendedProvider(def);

  const recommendedModel = (def: DefinitionForm): string =>
    recommendedModelForRole({ role: def.role, provider: resolvedProvider(def), prefs: roleModels });

  const resolvedModel = (def: DefinitionForm): string =>
    def.modelOverride !== undefined && def.modelOverride !== ''
      ? def.modelOverride
      : recommendedModel(def);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex w-full shrink-0 items-start gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={form.name}
              onChange={(event) => onChangeMeta({ name: event.target.value })}
              placeholder="Untitled workflow"
              aria-label="Workflow name"
              className="border-transparent bg-transparent px-0 text-base font-semibold shadow-none hover:border-border-soft focus:border-border"
            />
            <Input
              value={form.description}
              onChange={(event) => onChangeMeta({ description: event.target.value })}
              placeholder="Add a short description"
              aria-label="Workflow description"
              className="border-transparent bg-transparent px-0 text-xs text-muted-foreground shadow-none hover:border-border-soft focus:border-border"
            />
            <span className="text-2xs text-muted-foreground/60">Changes save automatically</span>
            {error !== null ? (
              <span className="text-2xs font-medium text-danger" role="alert">
                {error}
              </span>
            ) : null}
          </div>
          <WorkflowHeaderActions
            isNew={isNew}
            saving={saving}
            generating={generating}
            canGenerate={canGenerate}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onGenerate={onGenerate}
            onReset={onReset}
            onBack={onClose}
          />
        </div>

        <Divider />

        <div className="flex shrink-0 flex-col gap-5 py-5">
          <div className="mx-auto w-full max-w-2xl px-6">
            <Input
              value={form.goal}
              onChange={(event) => onChangeMeta({ goal: event.target.value })}
              placeholder="Optional goal shared with every step"
              aria-label="Workflow goal"
            />
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-expanded={isLibraryOpen}
                    onClick={() => setIsLibraryOpen((current) => !current)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    {isLibraryOpen ? (
                      <X size={11} aria-hidden />
                    ) : (
                      <Library size={11} aria-hidden />
                    )}
                    {isLibraryOpen ? 'Close library' : 'Step library'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-1 text-2xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
                    onClick={onAddBlank}
                  >
                    <Plus size={11} aria-hidden /> Add blank step
                  </button>
                </div>
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
                    connectedProviders={connectedProviders}
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
                    onModel={(v) =>
                      onUpdateStep(idx, {
                        modelOverride: v,
                        effort: clampEffort(v, def.effort),
                      })
                    }
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

      {isLibraryOpen ? <Divider orientation="vertical" /> : null}

      {isLibraryOpen ? (
        <aside className="flex w-72 shrink-0 flex-col">
          <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-4" fadeSize={24}>
            <StepLibraryPalette
              library={library}
              workspaceId={workspaceId}
              connectedProviders={connectedProviders}
              onStartDrag={onStartDrag}
              onAdd={onAddLibraryStep}
              onSaveDef={onSaveDef}
              onDeleteDef={onDeleteDef}
            />
          </ScrollFade>
        </aside>
      ) : null}
    </div>
  );
};
