import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { IssueToSession } from '../mockups/IssueToSession';

export const Issues = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="issues"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>From issue to branch</Eyebrow>
          <SectionTitle>Start where the work already lives</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            Linear, GitHub, GitLab, and Sentry each get an inbox inside the app. Pick a ticket and
            the session writes itself: goal filled in, branch named, worktree cut. The description,
            the comments, or the stack trace land in the shared context before the first agent
            speaks.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <IssueToSession />
        </div>
      </div>
    </section>
  );
};
