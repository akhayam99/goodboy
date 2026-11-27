import { StatusMark } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';

const ROWS = [
  { title: 'Backfill settlement boundaries', meta: 'HBL-433 · ledger-core · $3.10' },
  { title: 'Pick the retry window for notify-relay', meta: 'HBL-437 · notify-relay · $1.40' },
] as const satisfies ReadonlyArray<{ title: string; meta: string }>;

const CARDS = [
  'PR #76 is approved, checks 12 of 12.',
  'Paused at the $5.00 limit.',
  'Planner asks: back off to 30 minutes?',
] as const;

export const PhonePreview = () => (
  <div
    aria-hidden
    data-iphone-preview=""
    className="mask-fade-y h-75 w-54 shrink-0 overflow-hidden rounded-t-lg border border-b-0 border-border bg-subtle [--fade-bottom:6rem]"
  >
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between text-chip text-foreground">
        <span className="tabular-nums">9:41</span>
        <span className="h-4 w-14 rounded-md bg-foreground" />
        <span className="w-6" />
      </div>
      <div className="flex items-center justify-between text-chip text-muted-foreground">
        <span>Harborline</span>
        <span className="flex items-center gap-1">
          <StatusMark mark={{ kind: 'dot', tone: 'success' }} />4 running
        </span>
      </div>
      <span className="text-heading text-foreground">{NAMES.board}</span>
      <span className="text-chip text-foreground">
        {NAMES.running} <span className="text-faint-foreground">4</span>
      </span>
      <ul className="flex flex-col gap-2">
        {ROWS.map(({ title, meta }) => (
          <li key={title} className="flex flex-col">
            <span className="truncate text-chip text-foreground">{title}</span>
            <span className="truncate text-chip text-faint-foreground">{meta}</span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1">
        {CARDS.map((text) => (
          <li
            key={text}
            className="truncate rounded-md border border-border-soft bg-background px-2 py-1 text-chip text-muted-foreground"
          >
            {text}
          </li>
        ))}
      </ul>
    </div>
  </div>
);
