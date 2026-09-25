import { Play, Square, Terminal } from 'lucide-react';
import {
  IconButton,
  InteractiveRow,
  OverflowMenu,
  Tooltip,
  cn,
  type OverflowMenuItem,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RunnableScript } from '../../buildSessionScripts';
import { SCRIPT_CATEGORIES } from '../../classifyScript';
import { SCRIPT_SOURCE_LABEL } from '../../scriptSourceLabel';
import type { ScriptRunRecord } from '../../scripts';
import { describeLastRun } from './describeLastRun';
import { LastRunCell } from './LastRunCell';

type Props = {
  readonly script: RunnableScript;
  readonly record: ScriptRunRecord | null;
  readonly now: number;
  readonly isSelected: boolean;
  readonly blockedReason: string | null;
  readonly menuItems: ReadonlyArray<OverflowMenuItem>;
  readonly onOpen: (script: RunnableScript) => void;
  readonly onRun: (script: RunnableScript) => void;
  readonly onStop: (script: RunnableScript) => void;
};

const sourcePath = ({ script }: { readonly script: RunnableScript }): string | null => {
  if (script.source === 'saved' || script.relDir === '') {
    return null;
  }
  return `${script.relDir}/${SCRIPT_SOURCE_LABEL[script.source]}`;
};

export const ScriptRow = ({
  script,
  record,
  now,
  isSelected,
  blockedReason,
  menuItems,
  onOpen,
  onRun,
  onStop,
}: Props) => {
  const CategoryIcon =
    SCRIPT_CATEGORIES.find((candidate) => candidate.id === script.category)?.icon ?? Terminal;
  const isRunning = record?.status === 'pending';
  const lastRun = describeLastRun({ record, now });
  const path = sourcePath({ script });
  const sourceLabel = SCRIPT_SOURCE_LABEL[script.source];

  return (
    <InteractiveRow
      label={`Show ${script.name} output`}
      isSelected={isSelected}
      onOpen={() => onOpen(script)}
      dataAttributes={{ 'data-script-key': script.key }}
      className="flex h-8 items-center gap-2 px-2"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm bg-subtle text-faint-foreground',
          isRunning && 'spin-border spin-border-info',
        )}
      >
        <CategoryIcon size={ICON_SIZE.row} />
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 truncate text-sm font-medium text-foreground">{script.name}</span>
        <span className="min-w-0 truncate font-mono text-2xs text-faint-foreground">
          {script.command}
        </span>
      </span>
      {path === null ? (
        <span className="w-24 shrink-0 truncate text-2xs text-muted-foreground">{sourceLabel}</span>
      ) : (
        <Tooltip content={path}>
          <span className="pointer-events-auto w-24 shrink-0 truncate text-2xs text-muted-foreground">
            {sourceLabel}
          </span>
        </Tooltip>
      )}
      <LastRunCell lastRun={lastRun} blockedReason={blockedReason} />
      <span className="flex w-7 shrink-0 justify-center">
        {isRunning ? (
          <IconButton
            variant="ghost"
            icon={Square}
            iconSize={ICON_SIZE.row}
            label={`Stop ${script.name}`}
            className="p-1"
            onClick={() => onStop(script)}
          />
        ) : (
          <IconButton
            variant="ghost"
            icon={Play}
            iconSize={ICON_SIZE.row}
            label={`Run ${script.name}`}
            tooltip={blockedReason ?? undefined}
            disabled={blockedReason !== null}
            className="p-1"
            onClick={() => onRun(script)}
          />
        )}
      </span>
      <span className="flex w-6 shrink-0 justify-center">
        <OverflowMenu label={`More for ${script.name}`} items={menuItems} />
      </span>
    </InteractiveRow>
  );
};
