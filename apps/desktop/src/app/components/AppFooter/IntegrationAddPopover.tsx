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

const PANEL_WIDTH = 224;
const PANEL_MAX_HEIGHT = 240;

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
    disabled: isExhausted,
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

  return (
    <div ref={containerRef} className="relative">
      <Tooltip content={isExhausted ? exhaustedLabel : addLabel}>
        <button
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

      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {isOpen && (
          <>
            <DropdownBackdrop onClose={close} />
            <Popover
              innerRef={popupRef}
              role="dialog"
              ariaLabel={panelLabel}
              className={cn(popupClassName, 'flex flex-col')}
              style={popupStyle}
            >
              <ScrollFade
                className="max-h-60 min-h-0 flex-1"
                viewportClassName="py-1"
                fadeSize={12}
              >
                <ul aria-label={panelLabel} className="flex flex-col">
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
        )}
      </DropdownPortal>
    </div>
  );
};
