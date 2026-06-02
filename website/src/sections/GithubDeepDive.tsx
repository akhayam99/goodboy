import { Section } from '../components/Section';
import { GithubStudioSnapshot } from '../mockups/Snapshots';

export function GithubDeepDive() {
  return (
    <Section
      id="github"
      eyebrow="04 · GitHub Studio"
      reverse
      title={<>Every pull request, in one place.</>}
      body={
        <>
          <p>
            Every session&apos;s PR lands in one inbox, sorted by what it needs from you: draft, in
            review, changes requested, ready to merge. No more digging through github.com to find
            the one that&apos;s blocking you.
          </p>
          <p className="mt-4">
            Open one and the conversation, the checks and the reviewers are right there, next to the
            buttons that mark it ready or squash-merge it. A reviewer leaves a comment? Hand it to
            an agent and it pushes the fix straight back to the thread.
          </p>
        </>
      }
    >
      <GithubStudioSnapshot />
    </Section>
  );
}
