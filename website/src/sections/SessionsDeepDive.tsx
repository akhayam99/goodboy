import { Section } from '../components/Section';
import { SessionsSnapshot } from '../mockups/Snapshots';

export function SessionsDeepDive() {
  return (
    <Section
      id="sessions"
      eyebrow="Sessions"
      title={<>One rail. Every thread you have running.</>}
      body={
        <p>
          Goal, branch, worktree, agents, PR state and live cost, all collapsed into one rail. Open
          the worktree in Cursor, run a workspace script, jump between sessions with ⌘1-9.
        </p>
      }
    >
      <SessionsSnapshot />
    </Section>
  );
}
