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
            left rail keeps every active session a click away. The detail panel collapses agents,
            editor launchers, workspace scripts, PR state, and session settings behind a single
            action menu so the title gets the space it deserves.
          </p>
          <p>
            One click opens the worktree in Cursor or VS Code. Another runs a saved workspace script
            (deploy a preview, copy env, anything you script). The branch chip and the PR status
            ride alongside the running cost so you always know where the work is, what it cost, and
            whether CI is green.
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
