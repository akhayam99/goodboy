import { ArrowLeft, Lightbulb, LightbulbOff, Moon, RotateCcw, Sun } from 'lucide-react';
import { Button, ICON_SIZE, IconButton, buttonClasses, cn } from '@goodboy/ui';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { DEMO_LINKS } from './demoLinks';
import type { DemoTheme } from './director/demoProtocol';
import { quietClasses } from './quietClasses';

type HintsParams = {
  readonly isEnabled: boolean;
};

type Props = {
  readonly theme: DemoTheme;
  readonly isQuiet: boolean;
  readonly isHintsEnabled: boolean;
  readonly onToggleHints: (params: HintsParams) => void;
  readonly onRestart: () => void;
  readonly onToggleTheme: () => void;
};

const BRAND_TILE_PX = 24;

export const DemoTopBar = ({
  theme,
  isQuiet,
  isHintsEnabled,
  onToggleHints,
  onRestart,
  onToggleTheme,
}: Props) => {
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
        <span className="hidden text-label text-muted-foreground sm:inline">Playground</span>
        <div
          data-quiet={isQuiet ? 'true' : 'false'}
          className={cn('flex min-w-0 items-center gap-3', quietClasses({ isQuiet }))}
        >
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
        <Button
          variant="quiet"
          size="sm"
          aria-pressed={isHintsEnabled}
          onClick={() => onToggleHints({ isEnabled: !isHintsEnabled })}
        >
          {isHintsEnabled ? (
            <Lightbulb size={ICON_SIZE.control} aria-hidden />
          ) : (
            <LightbulbOff size={ICON_SIZE.control} aria-hidden />
          )}
          <span className="max-md:sr-only">{isHintsEnabled ? 'Hide hints' : 'Show hints'}</span>
        </Button>
        <Button variant="quiet" size="sm" onClick={onRestart}>
          <RotateCcw size={ICON_SIZE.control} aria-hidden />
          <span className="max-md:sr-only">Restart</span>
        </Button>
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
