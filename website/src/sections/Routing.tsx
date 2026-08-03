import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { RoleRouting } from '../mockups/RoleRouting';

export const Routing = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="routing"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Routing</Eyebrow>
          <SectionTitle>The model follows the job, not the habit</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            A scout listing files does not need your most expensive model. Every role ships with a
            provider, a model, and an effort level. Override a role for one workspace, or pick a
            different model on a single agent and leave the rest alone.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <RoleRouting />
        </div>
      </div>
    </section>
  );
};
