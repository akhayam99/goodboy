import { Section } from '../components/Section';
import { SessionsSnapshot } from '../mockups/Snapshots';

export function SessionsDeepDive() {
  return (
    <Section
      id="sessions"
      eyebrow="Sessions"
      title={<>One rail. Every thread you have running.</>}
      body={
        <>
          <p>
            A session is a unit of work: a goal, a branch, a worktree, a transcript, a ledger. The
            left rail keeps every active session a click away, with its kind, its state, and what it
            cost so far.
          </p>
          <p>
            Running sessions get a slow border pulse. Pending ones glow warning until you answer.
            Done ones fade. Status is the surface, not a separate spinner parked next to it.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Archive when finished. Reopen when you change your mind. Nothing is lost.
          </p>
        </>
      }
    >
      <SessionsSnapshot />
    </Section>
  );
}
