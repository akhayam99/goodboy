import {
  cn,
  DropdownBackdrop,
  DropdownPortal,
  Popover,
  ScrollFade,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { FooterIntegrationEntry } from './categories';
import { IntegrationAddRow } from './IntegrationAddRow';

type Props = {
  readonly members: ReadonlyArray<FooterIntegrationEntry>;
  readonly enabled: Record<IntegrationGlyphProvider, boolean>;
  readonly openers: Record<IntegrationGlyphProvider, () => void>;
  readonly isEmpty: boolean;
  readonly active: boolean;
};

const PANEL_WIDTH = 224;
const PANEL_MAX_HEIGHT = 240;

export const IntegrationAddPopover = ({ members, enabled, openers, isEmpty, active }: Props) => {
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
    align: 'center',
    width: 'w-56',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
    strategy: 'fixed',
    hasBackdrop: true,
  });

  const select = (provider: IntegrationGlyphProvider) => {
    close();
    openers[provider]();
  };

  const actionLabel = isEmpty ? 'Link your first integration' : 'Link integration';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Tooltip content={actionLabel}>
        <button
          type="button"
          onClick={toggle}
          aria-label={actionLabel}
          aria-expanded={isOpen}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs font-medium transition-colors',
            active
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <Plus size={12} aria-hidden />
          <span>Link integration</span>
        </button>
      </Tooltip>

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {isOpen ? (
          <>
            <DropdownBackdrop onClose={close} />
            <Popover
              innerRef={popupRef}
              role="dialog"
              ariaLabel="Integrations"
              className={cn(popupClassName, 'flex flex-col')}
              style={popupStyle}
            >
              <ScrollFade
                className="max-h-60 min-h-0 flex-1"
                viewportClassName="py-1"
                fadeSize={12}
              >
                <ul aria-label="Integrations" className="flex flex-col">
                  {members.map((member) => (
                    <IntegrationAddRow
                      key={member.provider}
                      member={member}
                      connected={enabled[member.provider]}
                      onSelect={() => select(member.provider)}
                    />
                  ))}
                </ul>
              </ScrollFade>
            </Popover>
          </>
        ) : null}
      </DropdownPortal>
    </div>
  );
};
