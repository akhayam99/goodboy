import { Section } from '../components/Section';
import { BudgetSnapshot } from '../mockups/Snapshots';

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
          <p className="text-[14px] text-muted-foreground/80">
            Subscription-based. Uses your Claude Max, Cursor Pro, ChatGPT Pro. No metered API
            tokens.
          </p>
        </>
      }
    >
      <BudgetSnapshot />
    </Section>
  );
}
