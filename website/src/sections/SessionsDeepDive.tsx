import { Section } from '../components/Section';
import { SessionsSnapshot } from '../mockups/Snapshots';

export function SessionsDeepDive() {
  return (
    <Section
      id="sessions"
      eyebrow="01 · Sessions"
      title={<>Everything you have running, in one rail.</>}
      body={
        <p>
          Each task keeps its own goal, branch, agents and PR, all in one place. One glance and you
          know what&apos;s working and what&apos;s waiting on you, instead of digging through ten
          terminal tabs trying to remember where you left each one.
        </p>
      }
    >
      <SessionsSnapshot />
    </Section>
  );
}
