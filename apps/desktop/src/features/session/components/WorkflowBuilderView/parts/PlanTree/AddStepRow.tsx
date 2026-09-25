import { Plus } from 'lucide-react';
import { WORK_NODE_GLYPH_SIZE, WorkNode } from '@goodboy/ui';
import { PlanTreeGutter } from './PlanTreeGutter';
import type { PlanLaneSpan } from './PlanTreeLane';

type Props = {
  readonly span: PlanLaneSpan;
  readonly identityIndex: number;
  readonly disabled: boolean;
  readonly onAdd: () => void;
};

export const AddStepRow = ({ span, identityIndex, disabled, onAdd }: Props) => (
  <li className="flex min-w-0 gap-1.5">
    <PlanTreeGutter
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
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="flex h-8 min-w-0 flex-1 items-center rounded-md pl-2 text-left text-xs text-faint-foreground transition-colors hover:bg-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      Add step
    </button>
  </li>
);
