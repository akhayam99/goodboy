import { Download } from 'lucide-react';
import { GithubIcon, ICON_SIZE } from '@goodboy/ui';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';

export const DemoClosing = () => (
  <section
    aria-label="Get Goodboy"
    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-soft bg-subtle px-5 py-4 motion-safe:animate-fade-in"
  >
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 className="text-heading text-foreground">That is the tour</h2>
      <p className="text-ui text-muted-foreground">Run the same flows on your own repositories.</p>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <DemoLink href={DEMO_LINKS.github} variant="secondary">
        <GithubIcon size={ICON_SIZE.control} />
        Star on GitHub
      </DemoLink>
      <DemoLink href={DEMO_LINKS.download} variant="primary">
        <Download size={ICON_SIZE.control} />
        Download for macOS
      </DemoLink>
    </div>
  </section>
);
