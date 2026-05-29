import { Section } from '../components/Section';
import { WorkflowRunSnapshot } from '../mockups/Snapshots';

export function PlansDeepDive() {
  return (
    <Section
      id="plans"
      eyebrow="Plans & workflows"
      title={<>Save a workflow once. Replay it on every goal.</>}
      body={
        <p>
          A workflow is a saved sequence of agent roles: scout, implement, review. Run it a step at
          a time, or flip on auto-run and let it carry the goal to a PR on its own. Plans land as
          first-class artifacts the implementer picks up, tracked end to end.
        </p>
      }
    >
      <WorkflowRunSnapshot />
    </Section>
  );
}
