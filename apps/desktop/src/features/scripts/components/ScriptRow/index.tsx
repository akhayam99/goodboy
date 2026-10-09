import { Pin, Play, Square, Terminal } from 'lucide-react';
import { IconButton, InteractiveRow, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RunnableScript } from '../../buildSessionScripts';
import { SCRIPT_CATEGORIES } from '../../classifyScript';
import { SCRIPT_SOURCE_LABEL } from '../../scriptSourceLabel';
import type { ScriptRunRecord } from '../../scripts';
import { describeLastRun } from './describeLastRun';
import { LastRunCell } from './LastRunCell';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import type { ScriptActionTarget } from '../../../actions/types';

type Props = {
  readonly script: RunnableScript;
  readonly record: ScriptRunRecord | null;
  readonly now: number;
  readonly isSelected: boolean;
  readonly showSource: boolean;
  readonly blockedReason: string | null;
  readonly target: ScriptActionTarget;
  readonly isPinned: boolean;
  readonly onTogglePin: () => void;
  readonly onOpen: (script: RunnableScript) => void;
  readonly onRun: (script: RunnableScript) => void;
  readonly onStop: (script: RunnableScript) => void;
};

const SCRIPT_ROW_SLOT = 'flex w-7 shrink-0 items-center justify-center';

const SCRIPT_ROW_REVEAL = cn(
  SCRIPT_ROW_SLOT,
  'invisible opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100',
);

const runsInLabel = ({ script }: { readonly script: RunnableScript }): string =>
  script.relDir === ''
    ? `Runs ${script.invocation}`
    : `Runs ${script.invocation} in ${script.relDir}`;

export const ScriptRow = ({
  script,
  record,
  now,
  isSelected,
  showSource,
  blockedReason,
  target,
  isPinned,
  onTogglePin,
  onOpen,
  onRun,
  onStop,
}: Props) => {
  const CategoryIcon =
    SCRIPT_CATEGORIES.find((candidate) => candidate.id === script.category)?.icon ?? Terminal;
  const isRunning = record?.status === 'pending';
  const lastRun = describeLastRun({ record, now });
  const sourceLabel = SCRIPT_SOURCE_LABEL[script.source];
  const menu = useObjectMenuTrigger({ target, anchorKey: `script:${script.key}` });

  return (
    <InteractiveRow
      label={`Show ${script.name} output`}
      isSelected={isSelected}
      onOpen={() => onOpen(script)}
      menu={menu}
      frameClassName="group"
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
        <Tooltip content={runsInLabel({ script })}>
          <span className="shrink-0 truncate text-row text-foreground">{script.name}</span>
        </Tooltip>
        <span className="min-w-0 truncate font-mono text-meta text-faint-foreground">
          {script.body}
        </span>
      </span>
      {showSource ? (
        <span className="w-24 shrink-0 truncate text-meta text-muted-foreground">
          {sourceLabel}
        </span>
      ) : null}
      <LastRunCell lastRun={lastRun} blockedReason={blockedReason} />
      <span className="flex shrink-0 items-center justify-end">
        <span data-reveal="hover" className={SCRIPT_ROW_REVEAL}>
          <IconButton
            size="xs"
            variant="ghost"
            icon={Pin}
            iconSize={ICON_SIZE.row}
            label={isPinned ? `Unpin ${script.name}` : `Pin ${script.name}`}
            aria-pressed={isPinned}
            tone={isPinned ? 'primary' : 'neutral'}
            onClick={onTogglePin}
          />
        </span>
        {isRunning ? (
          <span className={SCRIPT_ROW_SLOT}>
            <IconButton
              size="xs"
              variant="ghost"
              icon={Square}
              iconSize={ICON_SIZE.row}
              label={`Stop ${script.name}`}
              onClick={() => onStop(script)}
            />
          </span>
        ) : (
          <span data-reveal="hover" className={SCRIPT_ROW_REVEAL}>
            <IconButton
              size="xs"
              variant="ghost"
              icon={Play}
              iconSize={ICON_SIZE.row}
              label={`Run ${script.name}`}
              tooltip={blockedReason ?? undefined}
              disabled={blockedReason !== null}
              onClick={() => onRun(script)}
            />
          </span>
        )}
        <span data-reveal="hover" className={SCRIPT_ROW_REVEAL}>
          <ObjectOverflowMenu
            target={target}
            label={`More for ${script.name}`}
            anchorKey={`script:${script.key}`}
          />
        </span>
      </span>
    </InteractiveRow>
  );
};
