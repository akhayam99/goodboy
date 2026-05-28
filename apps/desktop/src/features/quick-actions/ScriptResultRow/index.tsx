import { useRef, useState } from 'react';
import { ScrollText, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { WorkspaceScript } from '@goodboy/types';
import type { ScriptRunResult } from '../../scripts';

export interface ScriptResultState {
  readonly script: WorkspaceScript;
  readonly status: 'pending' | 'ok' | 'error';
  readonly result: ScriptRunResult | null;
}

interface Props {
  readonly state: ScriptResultState;
  readonly onDismiss: () => void;
}

/**
 * Sticky result of a `$` quick-action script run, shown above the composer.
 * Never sent to the LLM, stays until dismissed or replaced by the next run.
 */
export function ScriptResultRow({ state, onDismiss }: Props) {
  const { script, status, result } = state;
  const [outputOpen, setOutputOpen] = useState(false);

  // Default the disclosure open on a failed run, the user almost always
  // wants to see why. Successful runs stay collapsed.
  const prevResultRef = useRef<ScriptRunResult | null>(null);
  if (result !== prevResultRef.current) {
    prevResultRef.current = result;
    setOutputOpen(result !== null && result.exitCode !== 0);
  }

  const hasOutput = result !== null && (result.stdout.length > 0 || result.stderr.length > 0);

  return (
    <div
      className={cn(
        'flex flex-col rounded-[6px] bg-subtle/80 ring-1 ring-border-soft',
        status === 'pending' && 'spin-border spin-border-info',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Dot status={status} />
        <span className="min-w-0 flex-1 truncate text-xs">
          <span className="text-muted-foreground">
            {status === 'pending' ? 'running ' : 'ran '}
          </span>
          <span className="font-medium text-foreground">{script.name}</span>
          {result !== null ? (
            <span className="text-muted-foreground"> · exit {result.exitCode}</span>
          ) : null}
        </span>
        {hasOutput ? (
          <button
            type="button"
            onClick={() => setOutputOpen((v) => !v)}
            aria-expanded={outputOpen}
            title={outputOpen ? 'hide output' : 'show output'}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded transition-colors',
              outputOpen
                ? 'bg-primary/15 text-primary ring-1 ring-inset ring-primary/30'
                : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground',
            )}
          >
            <ScrollText size={12} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          title="dismiss"
          aria-label="dismiss script result"
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
      {hasOutput && outputOpen && result !== null ? (
        <pre className="mx-3 mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-background px-2 py-1.5 font-mono text-2xs leading-relaxed text-foreground/80">
          {result.stdout}
          {result.stderr ? (
            <span className="text-danger">
              {result.stdout ? '\n' : ''}
              {result.stderr}
            </span>
          ) : null}
        </pre>
      ) : null}
    </div>
  );
}

function Dot({ status }: { readonly status: ScriptResultState['status'] }) {
  const color = status === 'ok' ? 'bg-success' : status === 'error' ? 'bg-danger' : 'bg-border';
  const label =
    status === 'ok' ? 'script succeeded' : status === 'error' ? 'script failed' : 'script running';
  return (
    <span className={cn('size-2 shrink-0 rounded-full', color)} role="img" aria-label={label} />
  );
}
