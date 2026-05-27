import { Section } from '../components/Section';
import { WorkflowStackSnapshot } from '../mockups/Snapshots';

export function PlansDeepDive() {
  return (
    <Section
      id="plans"
      eyebrow="Plans & workflows"
      title={<>Stack workflows on one session. Plans land as artifacts.</>}
      body={
        <>
          <p>
            A workflow is a reusable sequence of typed steps (scout, plan, implement, review, debug,
            test, docs). Attach one to start a session, then stack another on top when the work
            forks. One session can carry many workflows in flight, each tracked end to end.
          </p>
          <p>
            Pick a preset or design a fresh one from a theme. The planner agent emits structured
            output wrapped in <code className="font-mono text-warning">&lt;&lt;plan&gt;&gt;</code>{' '}
            markers; Goodboy lifts them out of the chat and stores them as first-class plan
            artifacts the implementer can consume.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            Workflows live at the workspace. Plans live at the session. The boundary is explicit so
            templates stay reusable and artifacts stay specific to the work that produced them.
          </p>
        </>
      }
    >
      <WorkflowStackSnapshot />
    </Section>
  );
}
