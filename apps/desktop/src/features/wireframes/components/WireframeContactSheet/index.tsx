import { useEffect, useMemo, useRef } from 'react';
import type { WireframeDocument } from '@goodboy/core';
import { Button, cn, Eyebrow } from '@goodboy/ui';
import { contactSheetPlates } from '../../contactSheetLayout';
import type { WireframePalette } from '../../wireframePalette';
import type { WireframeSheetInteraction } from './interaction';
import type { WireframeSheetSurface } from './surface';
import { WireframeSheetFrame } from './WireframeSheetFrame';

type Props = {
  readonly document: WireframeDocument;
  readonly palette: WireframePalette;
  readonly surface?: WireframeSheetSurface;
  readonly interaction?: WireframeSheetInteraction | null;
};

export const WireframeContactSheet = ({
  document,
  palette,
  surface = 'app',
  interaction = null,
}: Props) => {
  const plates = useMemo(
    () => contactSheetPlates({ screens: document.screens }),
    [document.screens],
  );
  const currentRef = useRef<HTMLLIElement>(null);
  const currentScreenId = interaction?.currentScreenId ?? null;

  useEffect(() => {
    if (currentScreenId === null) {
      return;
    }
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentScreenId]);

  return (
    <section
      data-testid="wireframe-contact-sheet"
      aria-label="Screens"
      className="print-screens flex min-w-0 flex-col gap-3"
    >
      <div className="flex items-baseline gap-2">
        <h3>
          <Eyebrow label="Screens" />
        </h3>
        <span className="tabular-nums text-2xs text-muted-foreground">
          {document.screens.length}
        </span>
      </div>
      <ol className="print-frames flex flex-wrap items-start gap-6">
        {document.screens.map((screen, index) => {
          const isCurrent = screen.id === currentScreenId;
          return (
            <li
              key={screen.id}
              ref={isCurrent ? currentRef : null}
              data-testid="wireframe-sheet-item"
              aria-current={isCurrent ? 'true' : undefined}
              className="print-frame group flex flex-col gap-1.5"
            >
              <div
                className="flex min-w-0 items-center gap-2"
                style={{ width: plates[screen.viewport] }}
              >
                <span className="shrink-0 tabular-nums text-2xs text-muted-foreground">
                  {index + 1}
                </span>
                <span className="truncate text-2xs font-medium text-foreground">
                  {screen.title}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">{screen.viewport}</span>
                {interaction === null ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'shrink-0 motion-safe:transition-opacity',
                      isCurrent
                        ? 'opacity-100'
                        : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
                    )}
                    data-testid="wireframe-sheet-open"
                    title={`Open ${screen.title} on its own, where you can zoom it`}
                    onClick={() => interaction.onOpenScreen(screen.id)}
                  >
                    Open
                  </Button>
                )}
              </div>
              <WireframeSheetFrame
                screen={screen}
                palette={palette}
                plates={plates}
                isCurrent={isCurrent}
                surface={surface}
                interaction={interaction}
              />
              {screen.note === undefined ? null : (
                <span
                  className="text-2xs italic text-muted-foreground"
                  style={{ width: plates[screen.viewport] }}
                >
                  {screen.note}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
