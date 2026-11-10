import { Download, RotateCcw } from 'lucide-react';
import { Button, GithubIcon, ICON_SIZE, WorkNode } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';
import type { ClosingCopy } from './closingCopyOf';
import type { DemoGroup } from './demoGroups';
import type { DemoTheme } from './director/demoProtocol';
import { downloadHrefOf } from './downloadHrefOf';

const BRAND_TILE_PX = 56;

type Props = {
  readonly copy: ClosingCopy;
  readonly theme: DemoTheme;
  readonly groups: ReadonlyArray<DemoGroup>;
  readonly onRestart: () => void;
};

export const DemoClosing = ({ copy, theme, groups, onRestart }: Props) => (
  <section
    aria-label="Get Goodboy"
    data-testid="demo-closing"
    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 rounded-lg border border-frame-edge bg-background px-6 shadow-md"
  >
    <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
    <ol aria-label="What you did" className="flex w-full max-w-lg flex-col gap-3">
      {groups.map((group) => (
        <li key={group.id} className="flex min-w-0 items-start gap-3">
          <WorkNode state="done" label={`${group.title}, done`} mark={{ kind: 'dot' }} />
          <span className="min-w-0 text-body text-muted-foreground">{group.outro}</span>
        </li>
      ))}
    </ol>
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
      <Button variant="ghost" size="md" onClick={onRestart}>
        <RotateCcw size={ICON_SIZE.control} aria-hidden />
        Replay the demo
      </Button>
    </div>
  </section>
);
