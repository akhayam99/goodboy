import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { Glance } from '../../glance/glanceOf';

type Props = {
  readonly id: string;
  readonly glance: Glance;
  readonly spend: string | null;
  readonly settings: ReactNode;
  readonly revealEvent?: string;
  readonly isStateShown?: boolean;
};

const CHIP_OPEN_EVENTS: ReadonlyArray<string> = [
  'goodboy:open-model-picker',
  'goodboy:open-permission-picker',
];

export const RunGlanceLine = ({
  id,
  glance,
  spend,
  settings,
  revealEvent,
  isStateShown = true,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const tint = tintClasses(glance.tone);
  const settingsId = `run-settings-${id}`;

  useEffect(() => {
    const names = revealEvent === undefined ? CHIP_OPEN_EVENTS : [...CHIP_OPEN_EVENTS, revealEvent];
    const reveal = () => setIsOpen(true);
    for (const name of names) {
      window.addEventListener(name, reveal);
    }
    return () => {
      for (const name of names) {
        window.removeEventListener(name, reveal);
      }
    };
  }, [revealEvent]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div data-glance={glance.state} className="flex min-h-6 min-w-0 items-center gap-2 text-meta">
        {isStateShown ? (
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-1.5 shrink-0 rounded-full',
              tint.dot,
              glance.isLive && 'motion-safe:animate-soft-pulse',
            )}
          />
        ) : null}
        <span role="status" aria-live="polite" className="flex min-w-0 items-center gap-2">
          {isStateShown ? (
            <span className={cn('shrink-0 text-row', tint.text)}>{glance.word}</span>
          ) : null}
          {glance.sentence === '' ? null : (
            <>
              {isStateShown ? (
                <span aria-hidden="true" className="text-faint-foreground">
                  ·
                </span>
              ) : null}
              <span className="min-w-0 truncate text-muted-foreground">{glance.sentence}</span>
            </>
          )}
        </span>
        <span className="flex-1" />
        {spend === null ? null : <span className="shrink-0 text-faint-foreground">{spend}</span>}
        {settings === null ? null : (
          <Button
            variant="quiet"
            size="xs"
            aria-expanded={isOpen}
            aria-label="Run settings"
            aria-controls={settingsId}
            onClick={() => setIsOpen((wasOpen) => !wasOpen)}
          >
            Settings
            <ChevronDown size={ICON_SIZE.row} aria-hidden className={cn(isOpen && 'rotate-180')} />
          </Button>
        )}
      </div>
      {settings === null ? null : (
        <div
          id={settingsId}
          data-open={isOpen}
          className={cn(
            'min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-3 py-2',
            isOpen ? 'flex' : 'hidden',
          )}
        >
          {settings}
        </div>
      )}
    </div>
  );
};
