import { Download } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
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
    <div className="flex max-w-md flex-col items-center gap-2 text-center">
      <h2 className="text-display text-foreground">Get Goodboy</h2>
      <p className="text-heading text-muted-foreground">
        Your issue, your decisions, a reviewed fix pushed.
      </p>
    </div>
    <DemoLink href={DEMO_LINKS.download} variant="primary" size="md">
      <Download size={ICON_SIZE.control} />
      Download for macOS
    </DemoLink>
  </section>
);
