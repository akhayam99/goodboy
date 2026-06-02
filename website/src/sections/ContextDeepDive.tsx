import { Section } from '../components/Section';
import { ContextSnapshot } from '../mockups/Snapshots';

export function ContextDeepDive() {
  return (
    <Section
      id="context"
      eyebrow="02 · Shared context"
      reverse
      title={<>Your next agent shows up already briefed</>}
      body={
        <p>
          The goal, previous calls, files in play, and open questions all live next to the chat, so
          when a new agent takes over, it already knows the full story. No need to re-explain
          yourself.
        </p>
      }
    >
      <ContextSnapshot />
    </Section>
  );
}
