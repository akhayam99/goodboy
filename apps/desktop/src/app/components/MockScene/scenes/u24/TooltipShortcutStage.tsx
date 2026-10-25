import { Bot, FolderOpen } from 'lucide-react';
import { ICON_SIZE, IconButton, Tooltip } from '@goodboy/ui';

export const TooltipShortcutStage = () => (
  <div
    data-testid="tooltip-shortcut"
    className="flex w-80 flex-col gap-6 rounded-lg border border-border-soft bg-subtle p-6 pb-14"
  >
    <span className="text-meta text-muted-foreground">rounding.ts</span>
    <div className="flex items-center gap-2">
      <Tooltip content="Start an agent" shortcut="ask.open" side="bottom" isOpen>
        <button
          type="button"
          aria-label="Start an agent on rounding.ts"
          className="inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <Bot size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
      <IconButton icon={FolderOpen} label="Show in Finder" />
    </div>
  </div>
);
