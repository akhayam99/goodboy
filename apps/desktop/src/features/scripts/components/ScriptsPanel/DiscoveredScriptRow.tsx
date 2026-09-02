import { useState } from 'react';
import { ChevronDown, ChevronRight, Play, Square } from 'lucide-react';
import { CardAction, CardActionSlot, cn } from '@goodboy/ui';
import type { ScriptRunRecord } from '../../scripts';
import { ScriptRunOutput } from './ScriptRunOutput';
import { SCRIPT_RUN_PRESENTATION } from './scriptRunPresentation';

type Props = {
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
  readonly run: ScriptRunRecord | null;
  readonly completedAt: number | undefined;
  readonly onRun: () => void;
  readonly onCancel: () => void;
};

export const DiscoveredScriptRow = ({
  scriptId,
  name,
  command,
  cwd,
  run,
  completedAt,
  onRun,
  onCancel,
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = run?.status ?? 'idle';
  const presentation = SCRIPT_RUN_PRESENTATION[status];

  return (
    <div className="flex flex-col gap-1">
      <div
        data-testid={`discovered-script-${scriptId}`}
        data-status={status}
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-md border px-2.5 py-2 motion-safe:transition-colors hover:bg-muted/50',
          isExpanded ? 'grid-rows-[auto_auto] gap-y-2' : 'grid-rows-[auto]',
          presentation.borderClass,
          presentation.pulseClass,
          isExpanded ? 'bg-muted/20' : 'bg-card/40',
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="col-start-1 row-start-1 flex min-w-0 flex-col gap-0.5 text-left"
        >
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate font-mono text-2xs text-muted-foreground">{command}</span>
        </button>

        <div className="col-start-2 row-start-1 flex items-start gap-1">
          <CardActionSlot label="Script lifecycle actions">
            {status === 'pending' ? (
              <CardAction
                icon={Square}
                label={`Stop ${name}`}
                tone="danger"
                size="default"
                onClick={onCancel}
              />
            ) : (
              <CardAction icon={Play} label={`Run ${name}`} size="default" onClick={onRun} />
            )}
          </CardActionSlot>
          <CardActionSlot label="Script navigation actions">
            <CardAction
              icon={isExpanded ? ChevronDown : ChevronRight}
              label={`${isExpanded ? 'Collapse' : 'Expand'} ${name}`}
              size="default"
              expanded={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
            />
          </CardActionSlot>
        </div>

        {isExpanded ? (
          <div className="col-span-2 flex flex-col gap-2">
            <p className="truncate font-mono text-2xs text-muted-foreground" title={cwd}>
              {cwd}
            </p>
            <div className="rounded-lg bg-subtle/40 p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
                {command}
              </pre>
            </div>
            {run !== null ? <ScriptRunOutput run={run} completedAt={completedAt} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
