import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { TerminalPane } from '../mockups/TerminalPane';

export const Terminal = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="terminal"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Terminal</Eyebrow>
          <SectionTitle>A real shell, one tab away</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            Agents are not the whole job. Goodboy keeps a real login shell next to the session:
            GPU-rendered, multi-tab, spawned the moment you ask. Start the dev server, tail a log,
            poke at the branch yourself, then hand the thread back.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <TerminalPane />
        </div>
      </div>
    </section>
  );
};
