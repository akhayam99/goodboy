import { ChevronRight } from '@goodboy/ui/icons';
import { ICON_SIZE, SelectableRow } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../../shared/components/IntegrationGlyph';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { useAppStore } from '../../../../store';
import { selectFollowedChannelCount } from '../../../../store/slices/integrations/selectFollowedChannelCount';
import { selectToolUseCount } from '../../../../store/slices/integrations/selectToolUseCount';
import type { ToolUseRowModel } from '../../model/toolUseRowsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly tool: IntegrationGlyphProvider;
  readonly row: ToolUseRowModel;
  readonly isPaused: boolean;
  readonly onOpen: () => void;
};

type ValueParams = {
  readonly count: number | null;
  readonly isPaused: boolean;
};

const valueTextOf = ({ count, isPaused }: ValueParams): string | null => {
  if (isPaused) {
    return 'Paused';
  }
  return count === null ? null : formatInteger(count);
};

export const ToolUseRow = ({ workspaceId, tool, row, isPaused, onOpen }: Props) => {
  const { source } = row;
  const count = useAppStore((state) =>
    source.kind === 'channels'
      ? selectFollowedChannelCount({ state, workspaceId })
      : selectToolUseCount({ state, workspaceId, tool, use: source.use }),
  );
  const value = valueTextOf({ count, isPaused });
  const Icon = row.icon;

  return (
    <SelectableRow
      selected={false}
      onClick={onOpen}
      ariaLabel={value === null ? row.label : `${row.label}, ${value}`}
      className="items-center gap-3 px-2 py-2"
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"
      >
        <Icon size={ICON_SIZE.control} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ui text-foreground">{row.label}</span>
        <span className="truncate text-meta text-muted-foreground">{row.detail}</span>
      </span>
      {value === null ? null : (
        <span
          data-tool-use-value=""
          className={
            isPaused
              ? 'shrink-0 text-ui text-muted-foreground'
              : 'shrink-0 text-ui tabular-nums text-foreground'
          }
        >
          {value}
        </span>
      )}
      <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
    </SelectableRow>
  );
};
