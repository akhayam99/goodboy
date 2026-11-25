import type { PointerEvent } from 'react';
import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { classifyStep } from '../../../../session/agent-kind';
import type { StepDraft } from '../../../engine';
import { roleSetLine } from '../../../roleSetLine';
import type { StepPolishFields } from '../../../stepPolishFields';
import { StepEditor } from '../../StepTree/StepEditor';
import { StepRow } from '../../StepTree/StepRow';
import type { StepLaneSpan } from '../../StepTree/StepTreeLane';

type Props = {
  readonly step: StepDraft;
  readonly index: number;
  readonly span: StepLaneSpan;
  readonly stepCount: number;
  readonly defaultProvider: ProviderId;
  readonly provider: ProviderId;
  readonly model: string;
  readonly recommendedModel: string;
  readonly roleModels: RoleModelPreferences | null;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly polish: StepPolishFields;
  readonly isLocked: boolean;
  readonly isExpanded: boolean;
  readonly isEdited: boolean;
  readonly isDragging: boolean;
  readonly isSaving: boolean;
  readonly onToggle: () => void;
  readonly onStartDrag: (event: PointerEvent) => void;
  readonly onPatch: (patch: Partial<StepDraft>) => void;
  readonly onMove: (direction: -1 | 1) => void;
  readonly onDuplicate: () => void;
  readonly onSaveAsStep: () => void;
  readonly onDelete: () => void;
  readonly onDone: () => void;
};

const IDENTITY_INDEX = 0;

export const WorkflowStepRow = ({
  step,
  index,
  span,
  stepCount,
  defaultProvider,
  provider,
  model,
  recommendedModel,
  roleModels,
  connectedProviders,
  polish,
  isLocked,
  isExpanded,
  isEdited,
  isDragging,
  isSaving,
  onToggle,
  onStartDrag,
  onPatch,
  onMove,
  onDuplicate,
  onSaveAsStep,
  onDelete,
  onDone,
}: Props) => {
  const isPinned = step.provider !== '' || step.model !== '';
  return (
    <StepRow
      step={step}
      ordinal={index + 1}
      kind={classifyStep({ step })}
      provider={provider}
      model={model}
      effort={step.effort}
      span={span}
      identityIndex={IDENTITY_INDEX}
      isExpanded={isExpanded}
      isEdited={isEdited}
      isPinned={isPinned}
      isDragging={isDragging}
      disabled={isLocked}
      onToggle={onToggle}
      onStartDrag={onStartDrag}
      onMoveUp={() => onMove(-1)}
      onMoveDown={() => onMove(1)}
      editor={
        <StepEditor
          step={step}
          ordinal={index + 1}
          stepCount={stepCount}
          effort={step.effort}
          recommendedProvider={defaultProvider}
          recommendedModel={recommendedModel}
          connectedProviders={connectedProviders}
          isRoutingOverridden={isPinned}
          roleSetLine={roleSetLine({ role: step.role, roleModels })}
          disabled={isLocked}
          polish={polish}
          onName={(name) => onPatch({ name })}
          onRole={(role) => onPatch({ role })}
          onPrompt={(prompt) => onPatch({ prompt })}
          onExpectedOutput={(expectedOutput) => onPatch({ expectedOutput })}
          onRoute={(route) => onPatch(route)}
          onVerbosity={(verbosity) => onPatch({ verbosity })}
          onRoutingReset={() => onPatch({ provider: '', model: '' })}
          onPin={() => onPatch({ provider, model })}
          onMoveUp={() => onMove(-1)}
          onMoveDown={() => onMove(1)}
          onDuplicate={onDuplicate}
          isSavingAsStep={isSaving}
          onSaveAsStep={onSaveAsStep}
          onDelete={onDelete}
          onDone={onDone}
        />
      }
    />
  );
};
