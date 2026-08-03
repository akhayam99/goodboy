import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { SlashSkills } from '../mockups/SlashSkills';

export const Skills = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="skills"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Skills</Eyebrow>
          <SectionTitle>Teach it your rituals once</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            Some prompts you retype every week: the release drill, the QA pass, the migration
            checklist. Write each one as a markdown skill in the workspace and call it with a slash.
            Any agent can run it, whichever provider is on duty.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <SlashSkills />
        </div>
      </div>
    </section>
  );
};
