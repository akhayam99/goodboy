import { Section } from '../components/Section';
import { ContextSnapshot } from '../mockups/Snapshots';

export function ContextDeepDive() {
  return (
    <Section
      id="context"
      eyebrow="Shared context"
      title={<>A scratchpad that survives the next agent.</>}
      body={
        <>
          <p>
            Every new chat starts from scratch. Goodboy doesn&apos;t. Five context slots (goal,
            decisions, files touched, open questions, last output) sit outside the transcript and
            persist across agents.
          </p>
          <p>
            A cheap summarizer updates them after each turn. You can edit them by hand at any time.
            Open questions get their own clustered tab so the next agent always knows what is still
            unresolved before it spawns.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            No re-explaining. No copy-paste between windows. No drift between agents on the same
            goal.
          </p>
        </>
      }
    >
      <ContextSnapshot />
    </Section>
  );
}
