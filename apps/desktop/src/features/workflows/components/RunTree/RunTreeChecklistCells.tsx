import type { ReactNode } from 'react';
import type { PlanChange } from '@goodboy/types';
import { ActivityMeta } from '@goodboy/ui';
import { PRESET_CHANGE_COPY } from '../../../../store/slices/workflows/presetChangeCopy';
import type { RowState } from '../../../workTreeModel/rowState';
import { RunTreeStepState } from './RunTreeStepState';

type Props = {
  readonly state: RowState;
  readonly duration: ReactNode;
  readonly change?: PlanChange | null;
  readonly action?: ReactNode;
};

export const RunTreeChecklistCells = ({ state, duration, change = null, action = null }: Props) => (
  <>
    {change === null ? null : (
      <span data-plan-change={change.kind} className="shrink-0 text-meta text-info">
        {PRESET_CHANGE_COPY.tag[change.kind]}
      </span>
    )}
    <ActivityMeta density="feed" columns={['state']} state={<RunTreeStepState state={state} />} />
    {action}
    <span data-checklist-cell="duration" className="flex shrink-0 justify-end">
      {duration}
    </span>
  </>
);
