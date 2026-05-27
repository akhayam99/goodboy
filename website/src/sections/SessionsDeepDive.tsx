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
            left rail keeps every active session a click away, with its kind, its state, what it
            cost so far, and the Linear ticket it came from when there is one.
          </p>
          <p>
            Running sessions get a slow border pulse. Pending ones glow warning until you answer.
            Done ones fade. Status is the surface, not a separate spinner parked next to it. The
            detail panel collapses every per-session action behind one menu so the title gets the
            space it deserves.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Jump between workspaces with ⌘1-9. Cycle sessions inside one with ⌘[ and ⌘]. Archive
            when finished, reopen when you change your mind, nothing is lost.
          </p>
        </>
      }
    >
      <SessionsSnapshot />
    </Section>
  );
}
