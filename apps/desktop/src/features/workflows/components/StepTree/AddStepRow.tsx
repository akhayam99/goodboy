import { Plus } from 'lucide-react';
import { WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import type { SavedStep, SavedStepGroups } from '../../savedSteps';
import { AddStepMenu } from '../AddStepMenu';
import { StepTreeGutter } from './StepTreeGutter';
import type { StepLaneSpan } from './StepTreeLane';

type Props = {
  readonly span: StepLaneSpan;
  readonly identityIndex: number;
  readonly disabled: boolean;
  readonly savedSteps: SavedStepGroups;
  readonly onAdd: (step: SavedStep | null) => void;
};

export const AddStepRow = ({ span, identityIndex, disabled, savedSteps, onAdd }: Props) => (
  <li className="flex min-w-0 gap-1.5">
    <StepTreeGutter
      span={span}
      identityIndex={identityIndex}
      node={
        <WorkNode
          state="queued"
          mark={{ kind: 'glyph', glyph: <Plus size={WORK_NODE_GLYPH_SIZE} aria-hidden /> }}
          label="New step"
        />
      }
    />
    <AddStepMenu groups={savedSteps} disabled={disabled} onPick={onAdd} />
  </li>
);
