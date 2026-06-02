import { Section } from '../components/Section';
import { SessionsSnapshot } from '../mockups/Snapshots';

export function SessionsDeepDive() {
  return (
    <Section
      id="sessions"
      eyebrow="01 · Sessions"
      title={<>Keep an eye on everything you&apos;re running</>}
      body={
        <p>
          Each task has its own goal, branch, agents, and PR all in one place. It&apos;s easy to see
          what&apos;s working and what needs your attention: no need to dig through multiple tabs to
          figure out where you left off.
        </p>
      }
    >
      <SessionsSnapshot />
    </Section>
  );
}
