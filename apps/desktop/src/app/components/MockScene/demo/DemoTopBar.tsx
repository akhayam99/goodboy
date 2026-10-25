import { ArrowLeft, Download, Moon, Sun } from 'lucide-react';
import { ICON_SIZE, IconButton, buttonClasses, chipClasses, cn } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';
import type { DemoTheme } from './director/demoProtocol';
import { quietClasses } from './quietClasses';

type Props = {
  readonly theme: DemoTheme;
  readonly isQuiet: boolean;
  readonly onToggleTheme: () => void;
};

const BRAND_TILE_PX = 24;

export const DemoTopBar = ({ theme, isQuiet, onToggleTheme }: Props) => {
  const isDark = theme === 'dark';
  const siteHref = `${DEMO_LINKS.site}/?theme=${theme}`;
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <a
          href={siteHref}
          aria-label="Goodboy website"
          className="flex items-center gap-3 rounded-lg text-foreground"
        >
          <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
          <span className="text-heading">Goodboy</span>
        </a>
        <div
          data-quiet={isQuiet ? 'true' : 'false'}
          className={cn('flex min-w-0 items-center gap-3', quietClasses({ isQuiet }))}
        >
          <span className="hidden text-label text-muted-foreground sm:inline">Playground</span>
          <a
            href={DEMO_LINKS.changelog}
            target="_blank"
            rel="noreferrer"
            aria-label={`What is new in ${APP_VERSION}`}
            className={cn(
              chipClasses({ tone: 'neutral', kind: 'state', isInteractive: true }),
              'max-sm:hidden',
            )}
          >
            v{APP_VERSION}
          </a>
          <a
            href={siteHref}
            className={cn(buttonClasses({ variant: 'ghost', size: 'sm' }), 'max-md:hidden')}
          >
            <ArrowLeft size={ICON_SIZE.control} aria-hidden />
            goodboy-ai.dev
          </a>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DemoLink href={DEMO_LINKS.download} variant="primary" className="lg:hidden">
          <Download size={ICON_SIZE.control} />
          Download for macOS
        </DemoLink>
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          size="md"
          onClick={onToggleTheme}
        />
      </div>
    </header>
  );
};
