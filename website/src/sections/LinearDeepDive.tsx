import { Section } from '../components/Section';
import { NewSessionLinearSnapshot } from '../mockups/Snapshots';

export function LinearDeepDive() {
  return (
    <Section
      id="linear"
      eyebrow="Linear (optional)"
      title={<>Start sessions from a ticket. Or just write your goal.</>}
      body={
        <p>
          Connect Linear and the new-session dialog grows an issue picker that auto-fills the goal
          and tags the session. Skip it and nothing changes. Token stored locally, no webhooks.
        </p>
      }
    >
      <NewSessionLinearSnapshot />
    </Section>
  );
}
