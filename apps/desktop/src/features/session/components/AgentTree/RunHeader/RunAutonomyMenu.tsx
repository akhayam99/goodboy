import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, ROW_INTERACTIVE, cn, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../../store';
import { RUN_AUTONOMY_HEADER, runAutonomyOf } from '../../../../workflows/runAutonomy';
import { RunAutonomyItems } from './RunAutonomyItems';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const RunAutonomyMenu = ({ sessionId, run }: Props) => {
  const setWorkflowRunAutonomy = useAppStore((state) => state.setWorkflowRunAutonomy);
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-60',
    expectedWidth: 240,
    expectedHeight: 140,
  });
  const current = runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={RUN_AUTONOMY_HEADER}
      anchorClassName="inline-flex"
      className="py-1"
      trigger={
        <button
          type="button"
          data-testid="run-autonomy-fact"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={`${RUN_AUTONOMY_HEADER}: ${current.label}`}
          onClick={dropdown.toggle}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-meta text-muted-foreground',
            ROW_INTERACTIVE,
            dropdown.open && 'bg-selected text-foreground',
          )}
        >
          {current.label}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        </button>
      }
    >
      <RunAutonomyItems
        autonomy={current.key}
        onChange={(next) => {
          dropdown.close();
          if (next === current.key) {
            return;
          }
          void setWorkflowRunAutonomy(sessionId, run.id, next);
        }}
      />
    </AnchoredPopover>
  );
};
