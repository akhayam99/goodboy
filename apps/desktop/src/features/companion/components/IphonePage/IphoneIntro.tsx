import { SectionLabel } from '@goodboy/ui';

const POINTS = [
  {
    title: 'See what needs you',
    body: 'A permission, question or plan waits, and you see it at once.',
  },
  {
    title: 'Decide from anywhere',
    body: 'Allow, answer and approve. Merging asks for Face ID first.',
  },
  {
    title: 'Stays between your devices',
    body: 'It talks to this Mac on your network. No account, no server.',
  },
] as const satisfies ReadonlyArray<{ title: string; body: string }>;

export const IphoneIntro = () => (
  <section aria-label="What your iPhone does" className="flex flex-col gap-2">
    <SectionLabel label="What your iPhone does" headingLevel={2} />
    <ul className="flex flex-col gap-3">
      {POINTS.map(({ title, body }) => (
        <li key={title} className="flex flex-col">
          <span className="text-row text-foreground">{title}</span>
          <span className="text-meta text-muted-foreground">{body}</span>
        </li>
      ))}
    </ul>
  </section>
);
