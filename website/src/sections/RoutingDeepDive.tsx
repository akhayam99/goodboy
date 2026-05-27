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
            Cursor. Codegen scaffold? Codex. Switch the session default at any time, or override
            just the next turn from the composer chip. Either way the next agent rebuilds from
            shared context, never the provider thread.
          </p>
          <p>
            Each turn carries an estimated cost. The session keeps a running total. Set an optional
            soft cap and Goodboy warns you before it overshoots. The cost chip ticks live next to
            the composer so the bill never lives in a different tab.
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
