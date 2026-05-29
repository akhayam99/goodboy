import { useInView } from '../components/Reveal';

interface Diff {
  readonly title: string;
  readonly hint: string;
}

const diffs: ReadonlyArray<Diff> = [
  {
    title: 'Four providers, one session',
    hint: 'Claude, Cursor, Codex and Gemini, routed per turn.',
  },
  {
    title: 'Context every agent inherits',
    hint: 'Goal, decisions, files and open questions persist outside the transcript.',
  },
  {
    title: 'Parallel multi-agent sessions',
    hint: 'Spawn roles that work at once, each in its own git worktree.',
  },
  {
    title: 'Plans as first-class artifacts',
    hint: 'Reusable workflows the implementer picks up, tracked end to end.',
  },
  {
    title: 'Per-session budget caps',
    hint: 'A live cost meter ticking against an optional soft cap.',
  },
  {
    title: 'Local-first, your keys',
    hint: 'Runs on your machine, your subscriptions, your data. No cloud sync.',
  },
];

function Check() {
  return (
    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
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
        <div className="reveal mb-10 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            Comparison
          </p>
          <h2 className="mt-4 text-3xl sm:text-4xl leading-[1.05] tracking-[-0.025em] font-semibold text-foreground">
            Where Goodboy fits.
          </h2>
          <p className="mt-5 max-w-prose text-[15px] leading-[1.7] text-muted-foreground">
            Not another IDE. The layer above. Keep your editor and your subscriptions, add the
            coordination no single tool gives you.
          </p>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          {diffs.map((d, i) => (
            <li
              key={d.title}
              className="reveal flex items-start gap-3 rounded-xl border border-border-soft bg-subtle px-4 py-3.5 transition-colors hover:border-border"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <Check />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-[-0.005em] text-foreground">
                  {d.title}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{d.hint}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
