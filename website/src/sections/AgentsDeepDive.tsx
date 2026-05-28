import { Section } from '../components/Section';
import { ChatHeaderSnapshot, AgentPickerSnapshot } from '../mockups/Snapshots';

export function AgentsDeepDive() {
  return (
    <Section
      id="agents"
      eyebrow="Agents"
      reverse
      title={<>Every agent has a role. Scoped, defaulted, swappable.</>}
      body={
        <>
          <p>
            Seven roles ship out of the box: <strong>scout</strong> reads and searches without
            editing, <strong>planner</strong> drafts steps and risks, <strong>implementer</strong>{' '}
            writes code, <strong>debugger</strong> reproduces and fixes, <strong>tester</strong>{' '}
            writes coverage, <strong>reviewer</strong> reads diffs, <strong>docs</strong> writes
            documentation. A generic agent catches anything else.
          </p>
          <p>
            Each role carries its own default model, default effort, and a system prompt that scopes
            what it is allowed to do. A scout asked to refactor will hand off to an implementer
            instead of editing the file.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Spawn freely. Each new agent inherits the session brief on the right (goal, decisions,
            open questions) so the next one starts already knowing what the last one was doing.
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
