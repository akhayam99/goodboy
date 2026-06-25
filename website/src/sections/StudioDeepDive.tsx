import { Section } from '../components/Section'
import { StudioComposeSnapshot } from '../mockups/Snapshots'

export function StudioDeepDive() {
  return (
    <Section
      id="studio"
      eyebrow="03 · Workflow Studio"
      title={<>Build it once, reuse it forever</>}
      body={
        <>
          <p>
            Refactor incoming? Set up a sequence: a cheap model to scout, a smart one to plan, a mid
            one to implement, another to review, and a final one to open the PR. Each step uses the
            right model, so you&apos;re never paying Opus prices to run a grep.
          </p>
          <p className="mt-4">
            Don&apos;t like that flow? Drag the steps around, swap models, and save it as your own.
          </p>
        </>
      }
    >
      <StudioComposeSnapshot />
    </Section>
  )
}
