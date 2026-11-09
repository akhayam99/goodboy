import { Download } from 'lucide-react';
import { GithubIcon, ICON_SIZE } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';
import type { ClosingCopy } from './closingCopyOf';
import type { DemoTheme } from './director/demoProtocol';
import { downloadHrefOf } from './downloadHrefOf';

const BRAND_TILE_PX = 56;

type Props = {
  readonly copy: ClosingCopy;
  readonly theme: DemoTheme;
};

export const DemoClosing = ({ copy, theme }: Props) => (
  <section
    aria-label="Get Goodboy"
    data-testid="demo-closing"
    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 rounded-lg border border-frame-edge bg-background px-6 shadow-md"
  >
    <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
    <p className="max-w-md text-center text-heading text-muted-foreground">
      Your issue, your decisions, a reviewed fix pushed.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-3">
      {copy.download === undefined ? (
        <p role="note" className="text-body text-muted-foreground">
          Goodboy for Windows is on the way.
        </p>
      ) : (
        <DemoLink href={downloadHrefOf({ theme })} variant="primary" size="md">
          <Download size={ICON_SIZE.control} />
          {copy.download}
        </DemoLink>
      )}
      <DemoLink href={DEMO_LINKS.github} variant="ghost" size="md">
        <GithubIcon size={ICON_SIZE.control} />
        Star on GitHub
      </DemoLink>
    </div>
  </section>
);
