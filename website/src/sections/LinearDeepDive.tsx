import { Section } from '../components/Section'
import { LinearStudioSnapshot } from '../mockups/Snapshots'

export function LinearDeepDive() {
  return (
    <Section
      id="linear"
      eyebrow="05 · Linear Studio"
      title={<>Turn any issue into a session</>}
      body={
        <>
          <p>
            Every issue assigned to you is grouped by state. Just pick one and the goal is set, the
            branch is named, and the PR is automatically linked. Now hit launch and a session kicks
            off, with the issue tracked above.
          </p>
          <p className="mt-4">
            Already shipped a PR and got review comments? Choose &ldquo;Continue on PR&rdquo;
            instead of &ldquo;Start fresh&rdquo; and continue where you left off.
          </p>
        </>
      }
    >
      <LinearStudioSnapshot />
    </Section>
  )
}
