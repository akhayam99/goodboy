import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, ROW_INTERACTIVE, cn, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { AppMenuList } from '../../../actions/AppMenuList';
import {
  RUN_AUTONOMY_HEADER,
  RUN_AUTONOMY_OPTIONS,
  runAutonomyOf,
} from '../../../workflows/runAutonomy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const OrchestratedAutonomyMenu = ({ sessionId, run }: Props) => {
  const setWorkflowRunAutonomy = useAppStore((state) => state.setWorkflowRunAutonomy);
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-60',
    expectedWidth: 240,
    expectedHeight: 160,
  });
  const current = runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy });
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'radio',
      key: 'autonomy',
      label: RUN_AUTONOMY_HEADER,
      choices: RUN_AUTONOMY_OPTIONS.map((option) => ({
        id: option.key,
        label: option.label,
        isCurrent: option.key === current.key,
        tooltip: option.hint,
      })),
      onSelect: (choice) => {
        const next = RUN_AUTONOMY_OPTIONS.find((option) => option.key === choice);
        if (next === undefined || next.key === current.key) {
          return;
        }
        void setWorkflowRunAutonomy(sessionId, run.id, next.key);
      },
    },
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="inline-flex"
      trigger={
        <button
          type="button"
          data-testid="run-autonomy-fact"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={`${RUN_AUTONOMY_HEADER}: ${current.label}`}
          onClick={dropdown.toggle}
          className={cn(
            'inline-flex items-center gap-1 rounded-md py-0.5 text-muted-foreground',
            ROW_INTERACTIVE,
            dropdown.open && 'bg-selected text-foreground',
          )}
        >
          <span className="text-faint-foreground">{RUN_AUTONOMY_HEADER}</span>
          <span className="text-foreground">{current.label}</span>
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        </button>
      }
    >
      <AppMenuList label={RUN_AUTONOMY_HEADER} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
