import { Section } from '../components/Section';
import { GithubPanelSnapshot } from '../mockups/Snapshots';

export function GithubDeepDive() {
  return (
    <Section
      id="github"
      eyebrow="GitHub"
      reverse
      title={<>The PR is a panel, not another tab.</>}
      body={
        <p>
          State, CI, line counts and line-anchored comments, all beside the session. One click on a
          comment spawns a resolver agent that makes the smallest fix, commits, and replies on the
          thread.
        </p>
      }
    >
      <GithubPanelSnapshot />
    </Section>
  );
}
