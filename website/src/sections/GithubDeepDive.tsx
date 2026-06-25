import { Section } from '../components/Section'
import { GithubStudioSnapshot } from '../mockups/Snapshots'

export function GithubDeepDive() {
  return (
    <Section
      id="github"
      eyebrow="04 · GitHub Studio"
      reverse
      title={<>One inbox for every pull request</>}
      body={
        <>
          <p>
            Every session&apos;s PR lands in the same inbox, sorted by status: draft, in review,
            changes requested, ready to merge. Forget about digging through GitHub to find
            what&apos;s blocking you.
          </p>
          <p className="mt-4">
            Open one PR and everything is right there: conversation, checks, and reviewers. Merge or
            squash when it&apos;s ready. A reviewer leaves a comment? Hand it to an agent and the
            fix goes straight back into the thread.
          </p>
        </>
      }
    >
      <GithubStudioSnapshot />
    </Section>
  )
}
