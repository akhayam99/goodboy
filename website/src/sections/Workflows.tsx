import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { WorkflowSteps } from '../mockups/WorkflowSteps';

export const Workflows = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="workflows"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Workflows</Eyebrow>
          <SectionTitle>The run you keep repeating, written down</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            Order the steps once and say what each one owes the next. Attach it to a session and you
            get one agent per step, already routed. Auto-run walks the chain on its own and stops
            the moment a step has a question for you.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <WorkflowSteps />
        </div>
      </div>
    </section>
  );
};
