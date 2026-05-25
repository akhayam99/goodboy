import { Section } from '../components/Section';
import { BudgetSnapshot } from '../mockups/Snapshots';

export function RoutingDeepDive() {
  return (
    <Section
      id="routing"
      eyebrow="Routing & cost"
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
            Each turn carries an estimated cost. The session keeps a running total. Set an optional
            soft cap and Goodboy stops the agent before it overshoots. No surprise invoice at the
            end of the day.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Subscription-based. Uses your Claude, Cursor, ChatGPT subscriptions. No metered API
            tokens.
          </p>
        </>
      }
    >
      <BudgetSnapshot />
    </Section>
  );
}
