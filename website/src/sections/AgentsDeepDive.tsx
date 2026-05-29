import { Section } from '../components/Section';
import { AgentRosterSnapshot } from '../mockups/Snapshots';

export function AgentsDeepDive() {
  return (
    <Section
      id="agents"
      eyebrow="Agents"
      reverse
      title={<>Every agent has a role. Scoped, defaulted, swappable.</>}
      body={
        <p>
          Seven roles ship by default, each with its own model and a prompt that scopes what it may
          touch. Spawn freely; every new agent inherits the session brief, so it arrives knowing the
          goal.
        </p>
      }
    >
      <AgentRosterSnapshot />
    </Section>
  );
}
