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
        <>
          <p>
            Pull requests live next to the session that opened them. State, CI checks, line counts,
            reviews — refreshed by client-side polling and immediately when an agent opens or
            updates a PR.
          </p>
          <p>
            Diff comments are line-anchored, from any reviewer: a teammate on GitHub, a Claude
            review agent run locally, or you writing one in the desktop. Each comment gets a
            one-click <em>resolve</em>. Click it and a resolver agent spawns in the session
            worktree, addresses the comment with the smallest reasonable change, commits locally,
            and posts back on the thread.
          </p>
          <p className="text-[14px] text-muted-foreground/80">
            No webhooks to configure. No browser tab to alt-tab. The conversation comes to where the
            code is.
          </p>
        </>
      }
    >
      <GithubPanelSnapshot />
    </Section>
  );
}
