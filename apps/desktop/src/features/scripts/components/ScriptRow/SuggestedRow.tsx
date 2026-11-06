import { Pin, Play } from 'lucide-react';
import { IconButton, Tooltip } from '@goodboy/ui';

import type { RunnableScript } from '../../buildSessionScripts';

type Props = {
  readonly script: RunnableScript;
  readonly lastRun: string | null;
  readonly blockedReason: string | null;
  readonly onRun: () => void;
  readonly onPin: () => void;
};

export const SuggestedRow = ({ script, lastRun, blockedReason, onRun, onPin }: Props) => (
  <div
    data-script-key={script.key}
    className="flex h-8 items-center gap-2 rounded-md px-2 opacity-70 transition-opacity focus-within:opacity-100 hover:opacity-100"
  >
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
    <IconButton
      icon={Play}
      label={`Run ${script.name}`}
      size="xs"
      disabled={blockedReason !== null}
      {...(blockedReason !== null && { tooltip: blockedReason })}
      onClick={onRun}
    />
  </div>
);
