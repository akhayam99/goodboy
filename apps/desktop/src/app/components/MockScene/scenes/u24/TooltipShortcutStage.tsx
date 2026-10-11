import { Bot, FolderOpen } from 'lucide-react';
import { IconButton, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

export const TooltipShortcutStage = () => (
  <div
    data-testid="tooltip-shortcut"
    className="flex w-80 flex-col gap-6 rounded-lg border border-border-soft bg-subtle p-6 pb-14"
  >
    <span className="text-label text-muted-foreground">rounding.ts</span>
    <div className="flex items-center gap-2">
      <Tooltip content="Ask an agent" shortcut="ask.open" side="bottom" isOpen>
        <button
          type="button"
          aria-label="Ask an agent about rounding.ts"
          className="inline-flex size-7 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          <Bot size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
      <IconButton icon={FolderOpen} label="Show in Finder" />
    </div>
  </div>
);
