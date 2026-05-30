import { Section } from '../components/Section';
import { StudioComposeSnapshot } from '../mockups/Snapshots';

export function StudioDeepDive() {
  return (
    <Section
      id="studio"
      eyebrow="Workflow Studio"
      reverse
      title={<>Compose your own pipelines from reusable steps.</>}
      body={
        <>
          <p>
            Workflow Studio is a full-screen composer. Drag steps from a shared library (scout,
            plan, implement, review, test, debug) into a preset, in any order. Every step picks its
            own provider, model and effort, so a cheap model scouts while Opus plans and Codex
            implements.
          </p>
          <p className="mt-4">
            Save it as a preset to reuse across every session, or run it once as a one-off. Broke
            something? Reset to defaults restores the built-ins; your custom presets stay put.
          </p>
        </>
      }
    >
      <StudioComposeSnapshot />
    </Section>
  );
}
