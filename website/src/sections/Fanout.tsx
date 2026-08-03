import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { FanOut } from '../mockups/FanOut';

export const Fanout = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="fanout"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Fan-out</Eyebrow>
          <SectionTitle>When the job is too big, the team grows</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            A scout that meets a huge repo splits into parallel child scouts, one per area, and
            their maps come back as one. A big plan does the same: it breaks into clusters, each
            with its own implementer. You asked once; the tree grew on its own.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <FanOut />
        </div>
      </div>
    </section>
  );
};
