import type { ReactNode } from 'react';

interface Item {
  readonly title: string;
  readonly hint: string;
  readonly icon: ReactNode;
}

const ICON_CLASS = 'h-4 w-4 text-primary';

const items: ReadonlyArray<Item> = [
  {
    title: 'Permission proxy',
    hint: 'Four modes gate tool calls. Audit trail, kill switch.',
    icon: (
      <svg viewBox="0 0 16 16" className={ICON_CLASS} aria-hidden>
        <path
          d="M8 2L3 4v4c0 3 2.5 5.5 5 6 2.5-.5 5-3 5-6V4l-5-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
        <path
          d="M6 8l1.5 1.5L10 7"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Git worktrees',
    hint: 'One branch + worktree per session. Auto-created, auto-cleaned.',
    icon: (
      <svg viewBox="0 0 16 16" className={ICON_CLASS} aria-hidden>
        <circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path
          d="M4 4.5v7M5.5 13c2.5 0 5-2 5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: 'Quick actions',
    hint: '$ scripts, ~ workflows, @ agents, / skills. Prefix-filtered.',
    icon: (
      <svg viewBox="0 0 16 16" className={ICON_CLASS} aria-hidden>
        <text
          x="8"
          y="11"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
          fontSize="9"
          fill="currentColor"
        >
          $ ~ @
        </text>
      </svg>
    ),
  },
  {
    title: 'Keyboard-first',
    hint: '⌘1-9 workspaces, ⌘[ / ⌘] sessions, ⌘K palette, ⌘⇧K model.',
    icon: (
      <svg viewBox="0 0 16 16" className={ICON_CLASS} aria-hidden>
        <rect
          x="1.5"
          y="4"
          width="13"
          height="8"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M4 10h.01M11.5 10h.01M6 10h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

/* Tight "and also" strip. Lives at the bottom of the deep-dive sequence so
   surfaces that don't warrant their own section still appear once. No prose,
   no per-card padding bloat: icon + label + one-line hint, period. Reads in a
   single mobile scroll. */
export function AlsoGrid() {
  return (
    <section id="also" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <p className="pb-7 text-center text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          And also
        </p>
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {items.map((it) => (
            <li
              key={it.title}
              className="flex items-start gap-3 rounded-lg border border-border-soft bg-subtle px-3.5 py-3 transition-colors hover:border-border"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-soft bg-muted">
                {it.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">
                  {it.title}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{it.hint}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
