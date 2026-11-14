import { useContext, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { Glance } from '../../glance/glanceOf';
import { SessionHeadSlotsContext } from '../../sessionHeadSlotsContext';
import { HeadSlotPortal } from '../HeadSlotPortal';

type Props = {
  readonly id: string;
  readonly glance: Glance;
  readonly spend: string | null;
  readonly settings: ReactNode;
  readonly revealEvent?: string;
  readonly isStateShown?: boolean;
  readonly isInHead?: boolean;
  readonly trailing?: ReactNode;
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
  isInHead = false,
  trailing = null,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const slots = useContext(SessionHeadSlotsContext);
  const isHeadRow = isInHead && slots !== null;
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

  const row = (
    <div
      data-glance={glance.state}
      data-glance-place={isHeadRow ? 'head' : 'page'}
      className="flex min-h-6 min-w-0 items-center gap-2 text-meta"
    >
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
      {isHeadRow ? null : <span className="flex-1" />}
      {spend === null ? null : (
        <span className="shrink-0 tabular-nums text-faint-foreground">{spend}</span>
      )}
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
      {trailing}
    </div>
  );

  const panel =
    settings === null ? null : (
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
    );

  if (isHeadRow) {
    return (
      <>
        <HeadSlotPortal slot="meta">{row}</HeadSlotPortal>
        {panel}
      </>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {row}
      {panel}
    </div>
  );
};
