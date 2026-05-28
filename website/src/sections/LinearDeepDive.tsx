import { Section } from '../components/Section';
import { NewSessionLinearSnapshot } from '../mockups/Snapshots';

export function LinearDeepDive() {
  return (
    <Section
      id="linear"
      eyebrow="Linear (optional)"
      title={<>Start sessions from a ticket. Or just write your goal.</>}
      body={
        <>
          <p>
            Sessions always start the same way: open the dialog, write what you want to do, pick a
            branch. If you connect a Linear workspace, the dialog grows an issue picker so you can
            skip the goal field entirely: pick a ticket assigned to you and the title, description,
            and identifier auto-fill the session.
          </p>
          <p>
            The Linear chip then rides with the session everywhere: in the rail, in the detail
            header, in the session footer. One click jumps back to the original ticket. If you never
            connect Linear, the dialog stays exactly as before. No nag, no fallback prompt.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Your OAuth token, stored locally. Issues fetched on demand, never synced. No webhooks to
            configure on the Linear side.
          </p>
        </>
      }
    >
      <NewSessionLinearSnapshot />
    </Section>
  );
}
