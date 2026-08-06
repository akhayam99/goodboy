import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, Popover, tintClasses, Tooltip } from '@goodboy/ui';
import { MoreHorizontal } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { MORE_STUDIOS, type MoreStudioId } from './moreStudios';

type Props = {
  readonly activeStudio: string | null;
  readonly hasUnseenRelease: boolean;
  readonly openers: Record<MoreStudioId, () => void>;
};

type PopoverCoordinates = {
  readonly top?: number;
  readonly bottom?: number;
  readonly left: number;
};

const PANEL_WIDTH = 208;
const PANEL_MAX_HEIGHT = 200;
const VIEWPORT_MARGIN = 8;
const PANEL_LABEL = 'More studios';
const REST_LABEL = 'More studios: budget, impact and changelog';
const UNSEEN_LABEL = 'More studios: budget, impact and changelog, new release notes to read';

export const MoreStudiosPopover = ({ activeStudio, hasUnseenRelease, openers }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coordinates, setCoordinates] = useState<PopoverCoordinates | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (trigger == null) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const desiredLeft = rect.right - PANEL_WIDTH;
      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenAbove = spaceBelow < PANEL_MAX_HEIGHT + VIEWPORT_MARGIN;
      const top = shouldOpenAbove ? undefined : rect.bottom + 6;
      const bottom = shouldOpenAbove ? window.innerHeight - rect.top + 6 : undefined;
      setCoordinates({ top, bottom, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const select = (id: MoreStudioId) => {
    setIsOpen(false);
    openers[id]();
  };

  const holdsActiveStudio = MORE_STUDIOS.some((entry) => entry.id === activeStudio);
  const label = hasUnseenRelease ? UNSEEN_LABEL : REST_LABEL;

  return (
    <>
      <Tooltip content={label}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={label}
          aria-expanded={isOpen}
          className={cn(
            'relative flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs font-medium transition-colors',
            holdsActiveStudio || isOpen
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <MoreHorizontal size={12} aria-hidden />
          <span>More</span>
          {hasUnseenRelease ? (
            <span
              data-testid="more-studios-dot"
              aria-hidden
              className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-info"
            />
          ) : null}
        </button>
      </Tooltip>

      {isOpen && coordinates != null
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-popover-backdrop"
                onMouseDown={() => setIsOpen(false)}
                aria-hidden
              />
              <Popover
                role="dialog"
                ariaLabel={PANEL_LABEL}
                className="fixed z-popover w-52"
                style={{
                  top: coordinates.top,
                  bottom: coordinates.bottom,
                  left: coordinates.left,
                }}
              >
                <ul aria-label={PANEL_LABEL} className="flex flex-col py-1">
                  {MORE_STUDIOS.map((entry) => {
                    const Icon = CONCEPT_ICONS[entry.id];
                    const isActive = activeStudio === entry.id;
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => select(entry.id)}
                          aria-label={entry.title}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-muted/50',
                            isActive && 'bg-muted',
                          )}
                        >
                          <Icon
                            size={12}
                            aria-hidden
                            className={
                              isActive
                                ? tintClasses(CONCEPT_TONE[entry.id]).icon
                                : 'text-muted-foreground'
                            }
                          />
                          <span className="flex-1 truncate text-xs text-foreground">
                            {entry.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Popover>
            </>,
            document.body,
          )
        : null}
    </>
  );
};
