import { Section } from '../components/Section';
import { WorkflowSnapshot } from '../mockups/Snapshots';

export function PlansDeepDive() {
  return (
    <Section
      id="plans"
      eyebrow="Plans & workflows"
      title={<>Plans are artifacts, not transcripts.</>}
      body={
        <>
          <p>
            Planner agents emit structured plans wrapped in{' '}
            <code className="font-mono text-warning">&lt;&lt;plan&gt;&gt;</code> markers. Goodboy
            lifts them out of the chat and stores them as first-class objects.
          </p>
          <p>
            A plan becomes a workflow: a sequence of typed steps (scout, plan, implement, review).
            Downstream agents pick the next one with the right model, the right effort, and the
            right slice of the context.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            No more scrolling a 4,000-line conversation to find what was decided.
          </p>
        </>
      }
    >
      <WorkflowSnapshot />
    </Section>
  );
}
