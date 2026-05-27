import { Section } from '../components/Section';
import { NewSessionLinearSnapshot } from '../mockups/Snapshots';

export function LinearDeepDive() {
  return (
    <Section
      id="linear"
      eyebrow="Linear"
      reverse
      title={<>Sessions start from the ticket, not the empty prompt.</>}
      body={
        <>
          <p>
            Connect a Linear workspace once and the new-session dialog grows an issue picker. Choose
            an issue assigned to you and the goal field auto-fills from its title and description.
            The branch slug derives from the ticket identifier.
          </p>
          <p>
            The Linear chip rides with the session everywhere it goes: in the rail, in the detail
            header, in the session footer. One click opens the original ticket in Linear so you
            never need a second tab to know where the work belongs.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Your OAuth token, stored locally. Issues fetched on demand, not synced. No webhooks to
            configure on the Linear side.
          </p>
        </>
      }
    >
      <NewSessionLinearSnapshot />
    </Section>
  );
}
