import { SectionLabel } from '@goodboy/ui';
import { PhonePreview } from './PhonePreview';

const POINTS = [
  {
    title: 'See what needs you',
    body: 'A permission, a question or a plan waits for you, and you see it the moment it does.',
  },
  {
    title: 'Decide from anywhere',
    body: 'Allow, answer and approve. Merging asks for Face ID first.',
  },
  {
    title: 'Stays between your devices',
    body: 'It talks to this Mac on your network. No account, no server in the middle.',
  },
] as const satisfies ReadonlyArray<{ title: string; body: string }>;

export const IphoneIntro = () => (
  <section aria-label="What your iPhone does" className="flex items-start gap-10">
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <SectionLabel label="What your iPhone does" headingLevel={2} />
      <ul className="flex flex-col gap-3">
        {POINTS.map(({ title, body }) => (
          <li key={title} className="flex flex-col">
            <span className="text-row text-foreground">{title}</span>
            <span className="text-ui text-muted-foreground">{body}</span>
          </li>
        ))}
      </ul>
    </div>
    <PhonePreview />
  </section>
);
