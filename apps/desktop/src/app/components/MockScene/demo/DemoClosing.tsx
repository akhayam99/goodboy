import { Download } from 'lucide-react';
import { GithubIcon, ICON_SIZE } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';

const BRAND_TILE_PX = 56;

export const DemoClosing = () => (
  <section
    aria-label="Get Goodboy"
    data-testid="demo-closing"
    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 rounded-lg border border-frame-edge bg-background px-6 shadow-md"
  >
    <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
    <p className="max-w-md text-center text-heading text-foreground">
      You took HBL-412 from a Linear issue to a fix ready to push, with agents doing the work and
      you making every call.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      <DemoLink href={DEMO_LINKS.download} variant="primary" size="md">
        <Download size={ICON_SIZE.control} />
        Download for macOS
      </DemoLink>
      <DemoLink href={DEMO_LINKS.github} variant="secondary" size="md">
        <GithubIcon size={ICON_SIZE.control} />
        Star on GitHub
      </DemoLink>
    </div>
    <a
      href={DEMO_LINKS.changelog}
      target="_blank"
      rel="noreferrer"
      aria-label={`What is new in ${APP_VERSION}`}
      className="rounded-md text-label text-muted-foreground hover:text-foreground"
    >
      Version {APP_VERSION}
    </a>
  </section>
);
