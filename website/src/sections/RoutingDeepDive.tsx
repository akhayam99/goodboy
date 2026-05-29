import { Section } from '../components/Section';
import { BudgetSnapshot } from '../mockups/Snapshots';

export function RoutingDeepDive() {
  return (
    <Section
      id="routing"
      eyebrow="Routing & cost"
      title={<>Four providers. One ledger.</>}
      body={
        <p>
          Pick the right provider per turn; the next agent rebuilds from shared context, never the
          thread. Every turn&apos;s cost ticks live against an optional soft cap, on your own
          subscriptions.
        </p>
      }
    >
      <BudgetSnapshot />
    </Section>
  );
}
