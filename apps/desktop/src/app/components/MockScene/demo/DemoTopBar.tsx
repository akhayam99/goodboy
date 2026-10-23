import { Download, Moon, Sun } from 'lucide-react';
import { GithubIcon, ICON_SIZE, IconButton, chipClasses, cn } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { DemoLink } from './DemoLink';
import { DEMO_LINKS } from './demoLinks';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
};

const BRAND_TILE_PX = 24;

export const DemoTopBar = ({ theme, onToggleTheme }: Props) => {
  const isDark = theme === 'dark';
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <BrandTile size={BRAND_TILE_PX} className="ring-1 ring-inset ring-frame-edge" />
        <span className="text-heading text-foreground">Goodboy</span>
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
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DemoLink href={DEMO_LINKS.github} variant="ghost" className="max-md:hidden">
          <GithubIcon size={ICON_SIZE.control} />
          Star on GitHub
        </DemoLink>
        <DemoLink href={DEMO_LINKS.download} variant="primary">
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
