import { Section } from '../components/Section';
import { PRSnapshot } from '../mockups/Snapshots';

export function GithubDeepDive() {
  return (
    <Section
      id="github"
      eyebrow="GitHub"
      reverse
      title={<>PRs live where you work.</>}
      body={
        <>
          <p>
            Open the GitHub panel next to your session. PR state, CI checks, reviews, linked issues.
            Refreshed by client-side polling every five minutes, and immediately when an agent
            creates a PR.
          </p>
          <p>
            Diff comments are line-anchored. Spawn a resolver agent on one with a click. It
            addresses the comment in the worktree, commits locally, and posts back. Approvals show
            up in the session feed so you never miss a green light.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            No webhooks to configure. No browser tab to alt-tab. The PR comes to you.
          </p>
        </>
      }
    >
      <PRSnapshot />
    </Section>
  );
}
