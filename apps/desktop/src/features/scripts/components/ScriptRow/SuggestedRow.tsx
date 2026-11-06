import { Pin } from 'lucide-react';
import { IconButton, InteractiveRow, SELECTED_ROW_CLASSES, Tooltip } from '@goodboy/ui';

import type { RunnableScript } from '../../buildSessionScripts';
import { RunToggle } from './RunToggle';

type Props = {
  readonly script: RunnableScript;
  readonly lastRun: string | null;
  readonly isRunning: boolean;
  readonly isSelected: boolean;
  readonly blockedReason: string | null;
  readonly onOpen: (() => void) | null;
  readonly onRun: () => void;
  readonly onStop: () => void;
  readonly onPin: () => void;
};

const ROW_CLASS = 'flex h-8 items-center gap-2 px-2';
const DIM_CLASS = 'opacity-70 transition-opacity focus-within:opacity-100 hover:opacity-100';

export const SuggestedRow = ({
  script,
  lastRun,
  isRunning,
  isSelected,
  blockedReason,
  onOpen,
  onRun,
  onStop,
  onPin,
}: Props) => {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <Tooltip content={`Runs ${script.invocation}`}>
          <span className="shrink-0 truncate text-row text-foreground">{script.name}</span>
        </Tooltip>
        <span className="min-w-0 truncate text-code text-faint-foreground">{script.body}</span>
      </span>
      {lastRun === null ? null : (
        <span className="shrink-0 text-meta text-faint-foreground">{lastRun}</span>
      )}
      <IconButton icon={Pin} label={`Pin ${script.name}`} tooltip="Pin" size="xs" onClick={onPin} />
      <RunToggle
        name={script.name}
        isRunning={isRunning}
        blockedReason={blockedReason}
        onRun={onRun}
        onStop={onStop}
      />
    </>
  );
  if (onOpen === null) {
    return (
      <div
        data-script-key={script.key}
        data-selected={isSelected}
        className={`${ROW_CLASS} rounded-md ${DIM_CLASS} ${SELECTED_ROW_CLASSES}`}
      >
        {content}
      </div>
    );
  }
  return (
    <InteractiveRow
      label={`Show ${script.name} output`}
      isSelected={isSelected}
      onOpen={onOpen}
      frameClassName={DIM_CLASS}
      dataAttributes={{ 'data-script-key': script.key }}
      className={ROW_CLASS}
    >
      {content}
    </InteractiveRow>
  );
};
