import { cn, Popover, tintClasses, Tooltip } from '@goodboy/ui';
import { MoreHorizontal } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { DropdownBackdrop } from '../../../shared/hooks/useDropdown/DropdownBackdrop';
import { DropdownPortal } from '../../../shared/hooks/useDropdown/DropdownPortal';
import { useDropdown } from '../../../shared/hooks/useDropdown';
import { MORE_STUDIOS, type MoreStudioId } from './moreStudios';

type Props = {
  readonly activeStudio: string | null;
  readonly hasUnseenRelease: boolean;
  readonly openers: Record<MoreStudioId, () => void>;
};

const PANEL_WIDTH = 208;
const PANEL_MAX_HEIGHT = 200;
const PANEL_LABEL = 'More studios';
const REST_LABEL = 'More studios: budget, impact and changelog';
const UNSEEN_LABEL = 'More studios: budget, impact and changelog, new release notes to read';

export const MoreStudiosPopover = ({ activeStudio, hasUnseenRelease, openers }: Props) => {
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupRef,
    popupStyle,
    popupClassName,
    portal,
    portalTarget,
  } = useDropdown({
    align: 'end',
    width: 'w-52',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
    strategy: 'fixed',
    hasBackdrop: true,
  });

  const select = (id: MoreStudioId) => {
    close();
    openers[id]();
  };

  const holdsActiveStudio = MORE_STUDIOS.some((entry) => entry.id === activeStudio);
  const label = hasUnseenRelease ? UNSEEN_LABEL : REST_LABEL;

  return (
    <div ref={containerRef} className="relative">
      <Tooltip content={label}>
        <button
          type="button"
          onClick={toggle}
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

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {isOpen && (
          <>
            <DropdownBackdrop onClose={close} />
            <Popover
              innerRef={popupRef}
              role="dialog"
              ariaLabel={PANEL_LABEL}
              className={popupClassName}
              style={popupStyle}
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
          </>
        )}
      </DropdownPortal>
    </div>
  );
};
