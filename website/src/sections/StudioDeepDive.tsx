import { Section } from '../components/Section';
import { StudioComposeSnapshot } from '../mockups/Snapshots';

export function StudioDeepDive() {
  return (
    <Section
      id="studio"
      eyebrow="07 · Workflow Studio"
      title={<>Build the flow once. Reuse it forever.</>}
      body={
        <>
          <p>
            Refactor incoming? Line up a sequence: a cheap model to scout the area, a smart one to
            plan it, a mid one to implement, another to review, a cheap one to open the PR. Each
            step picks its own provider and model, so you&apos;re never paying Opus prices to run a
            grep.
          </p>
          <p className="mt-4">
            Don&apos;t like that flow? Drag the steps around, swap the models, save it as your own.
          </p>
        </>
      }
    >
      <StudioComposeSnapshot />
    </Section>
  );
}
