import { Bot, Search } from 'lucide-react';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';

const ICON_BUTTON_CLASSES =
  'inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-hover hover:text-foreground';

export const TooltipLabelsStage = () => (
  <div
    data-testid="tooltip-labels"
    className="flex w-120 flex-col gap-16 rounded-lg border border-border-soft bg-subtle p-6 pb-24 pt-16"
  >
    <div className="flex items-center gap-12">
      <Tooltip content="Search" shortcut="ask.open" side="bottom" isOpen>
        <button type="button" aria-label="Search Harborline" className={ICON_BUTTON_CLASSES}>
          <Search size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
      <Tooltip content="Last run finished at 14:02, 3 minutes ago" side="bottom" isOpen>
        <span tabIndex={0} className="text-meta text-faint-foreground">
          3 min
        </span>
      </Tooltip>
      <Tooltip content="Checks are still running on payments-api" side="bottom" isOpen>
        <Button variant="primary" disabled>
          Merge
        </Button>
      </Tooltip>
    </div>
    <div className="flex items-center gap-2">
      <Tooltip
        content="Start an agent on the Northwind ledger-core change, with the plan from the last run and the open review comments attached"
        side="bottom"
        isOpen
      >
        <button type="button" aria-label="Start an agent" className={ICON_BUTTON_CLASSES}>
          <Bot size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
    </div>
  </div>
);
