import { Bot, FolderOpen, MousePointer2, SquareTerminal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BandRow, Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import type { OtherToolId, OtherToolUsage } from '../../otherTools';
import { OTHER_TOOL_COLUMN } from './otherToolColumns';

type ToolMeta = {
  readonly name: string;
  readonly icon: LucideIcon;
  readonly noun: string;
};

const TOOL_META: Readonly<Record<OtherToolId, ToolMeta>> = {
  'claude-code': { name: 'Claude Code', icon: Bot, noun: 'session' },
  codex: { name: 'Codex', icon: SquareTerminal, noun: 'session' },
  cursor: { name: 'Cursor', icon: MousePointer2, noun: 'chat' },
};

const MIN_BAR_PERCENT = 2;

type Props = {
  readonly tool: OtherToolUsage;
  readonly onReveal: (tool: OtherToolUsage) => void;
};

export const OtherToolRow = ({ tool, onReveal }: Props) => {
  const meta = TOOL_META[tool.id];
  const Icon = meta.icon;
  const share =
    tool.bytes === 0
      ? 0
      : Math.max(MIN_BAR_PERCENT, Math.round((tool.goodboyBytes / tool.bytes) * 100));
  return (
    <BandRow className={cn('grid gap-3', OTHER_TOOL_COLUMN.grid)}>
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-subtle text-muted-foreground"
      >
        <Icon size={ICON_SIZE.row} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-row text-foreground">{meta.name}</span>
        <span className="truncate font-mono text-meta text-faint-foreground">
          {tool.displayPath}
        </span>
      </span>
      <span className={OTHER_TOOL_COLUMN.count}>
        {formatInteger(tool.sessions)} {tool.sessions === 1 ? meta.noun : `${meta.noun}s`}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span
          role="img"
          aria-label={`${share}% from Goodboy sessions`}
          className="flex h-1 overflow-hidden rounded-full bg-muted"
        >
          <i className="block h-full bg-primary" style={{ width: `${share}%` }} />
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={OTHER_TOOL_COLUMN.size}>{formatBytes({ bytes: tool.bytes })}</span>
          <span className="truncate text-meta text-faint-foreground">
            {formatBytes({ bytes: tool.goodboyBytes })} from Goodboy sessions
          </span>
        </span>
      </span>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Show ${meta.name} in Finder`}
        onClick={() => onReveal(tool)}
      >
        <FolderOpen size={ICON_SIZE.row} aria-hidden />
        Show in Finder
      </Button>
    </BandRow>
  );
};
