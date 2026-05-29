import { Section } from '../components/Section';
import { ContextSnapshot } from '../mockups/Snapshots';

export function ContextDeepDive() {
  return (
    <Section
      id="context"
      eyebrow="Shared context"
      reverse
      title={<>A scratchpad that survives the next agent.</>}
      body={
        <p>
          Five slots (goal, decisions, files touched, open questions, last output) live outside the
          transcript and persist across agents. No re-explaining, no copy-paste, no drift.
        </p>
      }
    >
      <ContextSnapshot />
    </Section>
  );
}
