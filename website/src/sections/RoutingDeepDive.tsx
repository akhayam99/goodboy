import { Section } from '../components/Section';

export function RoutingDeepDive() {
  return (
    <Section
      id="routing"
      eyebrow="Routing & budget"
      reverse
      title={<>Three providers. One ledger.</>}
      body={
        <>
          <p>
            Pick the right provider for the work. Long-context refactor? Claude. Inline edit?
            Cursor. Codegen scaffold? Codex. Switch mid-session without re-explaining the goal:
            every turn is rebuilt from the shared context, not resumed from the provider&apos;s
            thread.
          </p>
          <p>
            Per-provider monthly caps. Per-session soft caps. Configurable threshold alerts. The
            cost chip ticks live next to every turn. No surprise invoice.
          </p>
          <p className="text-[oklch(0.78_0.01_255)] text-[14px]">
            Subscription-based. Uses your Claude Max, Cursor Pro, ChatGPT Pro. No metered API
            tokens.
          </p>
        </>
      }
    >
      <RoutingMockup />
    </Section>
  );
}

function RoutingMockup() {
  return (
    <div className="rounded-xl border border-border-soft bg-subtle p-5 shadow-md">
      <div className="flex items-center justify-between pb-4 border-b border-border-soft">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[oklch(0.58_0.015_255)]">
            Budget · May 2026
          </div>
          <div className="text-[13px] font-mono text-[oklch(0.92_0.006_90)]">all providers</div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded chip-success px-2 py-0.5 text-[10px]">
          <span className="h-1 w-1 rounded-full bg-current" />
          on track
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <BudgetCard
          provider="Anthropic"
          model="Claude Sonnet 4.6"
          spent={144}
          cap={250}
          color="oklch(0.74 0.15 55)"
          tasks={['planning', 'refactors', 'reviews']}
        />
        <BudgetCard
          provider="Cursor"
          model="cursor-default"
          spent={48}
          cap={150}
          color="oklch(0.70 0.16 290)"
          tasks={['inline edits', 'autocomplete']}
        />
        <BudgetCard
          provider="Codex"
          model="gpt-5-codex"
          spent={21}
          cap={150}
          color="oklch(0.72 0.16 150)"
          tasks={['scaffolds', 'one-shots']}
        />
      </div>
      <div className="mt-5 rounded-lg border border-[oklch(0.76_0.13_78_/_0.3)] bg-[oklch(0.76_0.13_78_/_0.06)] p-3 flex items-start gap-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          className="mt-0.5 text-[oklch(0.86_0.13_78)] shrink-0"
        >
          <path
            d="M8 2l6 11H2L8 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M8 7v3M8 11.5v.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="text-[12px] leading-relaxed">
          <div className="text-[oklch(0.92_0.006_90)] font-medium">Threshold alert</div>
          <div className="text-[oklch(0.78_0.01_255)]">
            Anthropic at 58% of the monthly cap with 13 days remaining. Heads-up before you hit it.
            Switch to Cursor or Codex from the model picker.
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetCard({
  provider,
  model,
  spent,
  cap,
  color,
  tasks,
}: {
  provider: string;
  model: string;
  spent: number;
  cap: number;
  color: string;
  tasks: string[];
}) {
  const pct = Math.round((spent / cap) * 100);
  return (
    <div className="rounded-lg border border-border-soft bg-[oklch(0.27_0.008_255)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <div>
            <div className="text-[13px] font-medium text-[oklch(0.92_0.006_90)]">{provider}</div>
            <div className="text-[10.5px] font-mono text-[oklch(0.68_0.015_255)]">{model}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-mono font-semibold" style={{ color }}>
            ${spent}
          </div>
          <div className="text-[10px] text-[oklch(0.58_0.015_255)]">of ${cap} cap</div>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {tasks.map((t) => (
          <span
            key={t}
            className="text-[10px] rounded px-1.5 py-0.5 bg-muted text-[oklch(0.78_0.01_255)] font-mono"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
