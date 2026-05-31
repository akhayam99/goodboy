import { Section } from '../components/Section';
import { ContextSnapshot } from '../mockups/Snapshots';

export function ContextDeepDive() {
  return (
    <Section
      id="context"
      eyebrow="02 · Shared context"
      reverse
      title={<>Your next agent shows up already briefed.</>}
      body={
        <p>
          The goal, the calls you&apos;ve already made, the files in play, the questions still open:
          it all lives next to the chat, not buried inside it. So when the next agent takes over, it
          already knows the story, whatever provider or model it runs on. You stop explaining
          yourself twice.
        </p>
      }
    >
      <ContextSnapshot />
    </Section>
  );
}
