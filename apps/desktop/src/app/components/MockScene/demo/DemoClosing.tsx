import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { DemoCoachMark } from './DemoCoachMark';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';
import { useClosingCoach } from './useClosingCoach';

const BRAND_TILE_PX = 56;
const COACH_COPY = 'Download Goodboy';

type Props = {
  readonly isHintsEnabled: boolean;
};

export const DemoClosing = ({ isHintsEnabled }: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const closing = useClosingCoach({ containerRef, targetRef, copy: COACH_COPY });
  return (
    <section
      ref={containerRef}
      aria-label="Get Goodboy"
      data-testid="demo-closing"
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-8 rounded-lg border border-frame-edge bg-background px-6 shadow-md"
    >
      <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <h2 className="text-display text-foreground">Get Goodboy</h2>
        <p className="text-heading text-muted-foreground">
          Your issue, your decisions, a reviewed fix pushed.
        </p>
      </div>
      <span ref={targetRef} className="inline-flex">
        <DemoLink href={DEMO_LINKS.download} variant="primary" size="md">
          <Download size={ICON_SIZE.control} />
          Download for macOS
        </DemoLink>
      </span>
      {closing === undefined || !isHintsEnabled || isDismissed ? null : (
        <DemoCoachMark
          coach={closing.coach}
          scale={1}
          bounds={closing.bounds}
          isSpotlit={false}
          onHide={() => setIsDismissed(true)}
        />
      )}
    </section>
  );
};
