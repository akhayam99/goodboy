import { Section } from '../components/Section';
import { LinearStudioSnapshot } from '../mockups/Snapshots';

export function LinearDeepDive() {
  return (
    <Section
      id="linear"
      eyebrow="05 · Linear Studio"
      title={<>Your Linear backlog, one click from a session.</>}
      body={
        <>
          <p>
            Every open issue assigned to you, bucketed by Linear state. Pick one and the goal is
            already written, the branch is named, the linked PR is recognized. Hit launch and a
            session is on it, with the issue tagged in the rail above.
          </p>
          <p className="mt-4">
            Already shipped a PR for that issue and got review comments? Pick &ldquo;Continue on
            PR&rdquo; instead of &ldquo;Start fresh&rdquo; and the same branch comes back, ready to
            push the next round.
          </p>
        </>
      }
    >
      <LinearStudioSnapshot />
    </Section>
  );
}
