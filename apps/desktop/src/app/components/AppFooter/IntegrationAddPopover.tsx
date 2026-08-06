import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, Popover, Tooltip } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { FooterIntegrationEntry } from './categories';
import { IntegrationAddRow } from './IntegrationAddRow';

type Props = {
  readonly addLabel: string;
  readonly emptyLabel: string;
  readonly exhaustedLabel: string;
  readonly panelLabel: string;
  readonly members: ReadonlyArray<FooterIntegrationEntry>;
  readonly enabled: Record<IntegrationGlyphProvider, boolean>;
  readonly openers: Record<IntegrationGlyphProvider, () => void>;
  readonly isExhausted: boolean;
  readonly showLabel: boolean;
  readonly active: boolean;
};

type PopoverCoordinates = {
  readonly top?: number;
  readonly bottom?: number;
  readonly left: number;
};

const PANEL_WIDTH = 224;
const PANEL_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

export const IntegrationAddPopover = ({
  addLabel,
  emptyLabel,
  exhaustedLabel,
  panelLabel,
  members,
  enabled,
  openers,
  isExhausted,
  showLabel,
  active,
}: Props) => {
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
      const centerX = rect.left + rect.width / 2;
      const desiredLeft = centerX - PANEL_WIDTH / 2;
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

  const toggle = () => {
    if (isExhausted) {
      return;
    }
    setIsOpen((current) => !current);
  };

  const select = (provider: IntegrationGlyphProvider) => {
    setIsOpen(false);
    openers[provider]();
  };

  return (
    <>
      <Tooltip content={isExhausted ? exhaustedLabel : addLabel}>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-label={isExhausted ? exhaustedLabel : addLabel}
          aria-expanded={isOpen}
          aria-disabled={isExhausted}
          className={cn(
            'flex items-center rounded-md py-1 text-2xs font-medium transition-colors',
            showLabel ? 'gap-1.5 px-2' : 'px-1.5',
            isExhausted
              ? 'cursor-default text-muted-foreground/40'
              : active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <Plus size={12} aria-hidden />
          {showLabel ? <span>{emptyLabel}</span> : null}
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
                ariaLabel={panelLabel}
                className="fixed z-popover w-56"
                style={{
                  top: coordinates.top,
                  bottom: coordinates.bottom,
                  left: coordinates.left,
                }}
              >
                <ul
                  aria-label={panelLabel}
                  className="flex flex-col overflow-y-auto py-1"
                  style={{ maxHeight: PANEL_MAX_HEIGHT }}
                >
                  {members.map((member) => (
                    <IntegrationAddRow
                      key={member.provider}
                      member={member}
                      connected={enabled[member.provider]}
                      onSelect={() => select(member.provider)}
                    />
                  ))}
                </ul>
              </Popover>
            </>,
            document.body,
          )
        : null}
    </>
  );
};
