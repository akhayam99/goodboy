import { useInView } from '../components/Reveal';

interface Row {
  readonly stack: string;
  readonly goodboy: string;
}

/* A real before/after. Left: life with a drawer full of separate tools.
   Right: the same moment with Goodboy. Each row is one pain you actually
   feel, answered. */
const rows: ReadonlyArray<Row> = [
  {
    stack: 'You paste the goal into every new chat',
    goodboy: 'The next agent shows up already briefed',
  },
  {
    stack: 'Each tool is tied to its own model',
    goodboy: 'Claude, Cursor, Codex and Gemini in one session',
  },
  {
    stack: 'You micromanage which model gets which task',
    goodboy: 'Goodboy taps your shoulder before you overpay',
  },
  {
    stack: 'The PR lives in another browser tab',
    goodboy: 'Every PR sits in one inbox, next to the work',
  },
  {
    stack: 'Your code and keys move through someone else’s cloud',
    goodboy: 'Everything runs on your machine, always',
  },
];

function Cross() {
  return (
    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/10 text-muted-foreground/50">
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M3 3l6 6M9 3l-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function Check() {
  return (
    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M2.5 6.5 5 9l4.5-5.5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Comparison() {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="compare"
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="reveal mb-12 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            A layer, not a tool
          </p>
          <h2 className="mt-4 text-pretty text-[30px] sm:text-[40px] leading-[1.12] tracking-[-0.02em] font-semibold text-foreground">
            A step above the tools you already use
          </h2>
          <p className="mt-5 max-w-prose text-pretty text-[16px] leading-[1.65] text-muted-foreground sm:text-[17px]">
            Keep your editor, keep your subscriptions. Goodboy doesn&apos;t replace any of it, it
            just gets the whole stack pulling in the same direction.
          </p>
        </div>

        <div className="reveal grid gap-3 sm:grid-cols-2" style={{ animationDelay: '120ms' }}>
          {/* the old way */}
          <div className="rounded-2xl border border-border-soft bg-subtle/40 p-5 sm:p-6">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              A drawer of separate tools
            </p>
            <ul className="flex flex-col gap-3.5">
              {rows.map((r) => (
                <li key={r.stack} className="flex items-start gap-2.5">
                  <Cross />
                  <span className="text-[14px] leading-snug text-muted-foreground">{r.stack}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* the Goodboy way */}
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 sm:p-6">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-primary/80">
              With Goodboy
            </p>
            <ul className="flex flex-col gap-3.5">
              {rows.map((r) => (
                <li key={r.goodboy} className="flex items-start gap-2.5">
                  <Check />
                  <span className="text-[14px] leading-snug text-foreground">{r.goodboy}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
