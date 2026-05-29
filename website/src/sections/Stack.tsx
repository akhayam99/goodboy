import { useInView } from '../components/Reveal';

const tech = ['Tauri 2', 'React 19', 'TypeScript', 'SQLite'] as const;

export function Stack() {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="stack"
      ref={ref}
      className={`reveal-group relative py-16 sm:py-20 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="reveal rounded-2xl border border-border-soft bg-subtle px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
            Local-first
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl leading-[1.1] tracking-[-0.02em] font-semibold text-foreground">
            Native shell. Your data stays home.
          </h2>
          <p className="mt-4 max-w-prose text-[15px] leading-[1.7] text-muted-foreground">
            Keys live in your OS keychain, SQLite on disk. Nothing leaves the machine unless an
            agent calls a provider you authorized.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {tech.map((t) => (
              <li
                key={t}
                className="rounded-full border border-border-soft bg-muted px-3 py-1 font-mono text-[11.5px] text-muted-foreground"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
