import { useState } from 'react';
import { ScrollFade, cn } from '@goodboy/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ScriptRunRecord } from '../../scripts';
import { formatClockTime } from '../../../../shared/utils/formatClockTime';
import { SCRIPT_RUN_PRESENTATION } from './scriptRunPresentation';

type Props = {
  readonly run: ScriptRunRecord;
  readonly completedAt: number | undefined;
};

export const ScriptRunOutput = ({ run, completedAt }: Props) => {
  const [open, setOpen] = useState(true);
  const result = run.result;

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground"
      >
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        <span>Last run</span>
        <span
          className={cn(
            'text-2xs font-normal capitalize',
            SCRIPT_RUN_PRESENTATION[run.status].textClass,
          )}
        >
          {run.status}
        </span>
        {result !== null ? (
          <span className="text-2xs font-normal text-muted-foreground">
            exit {result.exitCode}
            {completedAt !== undefined ? ` · ${formatClockTime({ iso: completedAt })}` : ''}
          </span>
        ) : null}
      </button>
      {open && result !== null ? (
        <ScrollFade
          className="max-h-56"
          viewportClassName="whitespace-pre-wrap break-all bg-subtle/40 px-3 py-2 font-mono text-2xs leading-relaxed text-foreground/80"
        >
          {result.stdout}
          {result.stderr !== '' ? (
            <span className="text-danger">
              {result.stdout !== '' ? '\n' : ''}
              {result.stderr}
            </span>
          ) : null}
          {result.stdout === '' && result.stderr === '' ? '(no output)' : null}
        </ScrollFade>
      ) : null}
      {open && result === null ? (
        <p className="px-1 text-2xs text-muted-foreground">Running…</p>
      ) : null}
    </div>
  );
};
