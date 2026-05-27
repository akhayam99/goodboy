import { Section } from '../components/Section';
import { ChatHeaderSnapshot, AgentPickerSnapshot } from '../mockups/Snapshots';

export function AgentsDeepDive() {
  return (
    <Section
      id="agents"
      eyebrow="Agents"
      title={<>Every agent is a different kind of dog.</>}
      body={
        <>
          <p>
            Goodboy ships eight role profiles: scout, planner, implementer, debugger, tester,
            reviewer, docs, plus a generic catch-all. Each carries a default model, a default
            effort, a default verbosity, and a system prompt that scopes what it is allowed to do.
          </p>
          <p>
            A small breed marker travels with the role. You see the same dog in the chat header, the
            sidebar chip, and the @ picker when you swap agents mid-session. Custom-named agents
            stay legible, the dog answers the "who am I talking to" question at a glance.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Spawn freely. Each agent inherits the session brief on the right (goal, decisions, open
            questions) so the next one starts already knowing what the last one was doing.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChatHeaderSnapshot />
        <AgentPickerSnapshot />
      </div>
    </Section>
  );
}
