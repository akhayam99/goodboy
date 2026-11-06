import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly state: string;
  readonly tone: Tone;
  readonly sentence: string;
  readonly note?: string | null;
  readonly children?: ReactNode;
};

export const DockStateLine = ({ state, tone, sentence, note = null, children }: Props) => (
  <div
    data-dock-row=""
    data-dock-line={state}
    className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ui"
  >
    <span
      aria-hidden="true"
      className={cn('inline-block size-1.5 shrink-0 rounded-full', tintClasses(tone).dot)}
    />
    <span className="flex min-w-0 grow-999 basis-64 flex-col">
      <span role="status" aria-live="polite" className="wrap-anywhere text-foreground">
        {sentence}
      </span>
      {note === null ? null : <span className="text-meta text-muted-foreground">{note}</span>}
    </span>
    {children === undefined ? null : (
      <span className="flex min-w-0 grow flex-wrap items-center justify-end gap-1">{children}</span>
    )}
  </div>
);
