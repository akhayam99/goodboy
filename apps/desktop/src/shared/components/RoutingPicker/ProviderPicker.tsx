import { ChevronDown } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { cn, DropdownPortal, Popover, useDropdown } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/chat/utils/chat-constants';
import { PickerSection } from './PickerSection';
import { ProviderGlyph } from './ProviderGlyph';
import { ProviderGrid } from './ProviderGrid';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId;
  readonly disabled: boolean;
  readonly onProvider: (provider: ProviderId) => void;
  readonly align?: 'start' | 'end';
  readonly ariaLabel?: string;
};

export const ProviderPicker = ({
  connectedProviders,
  provider,
  disabled,
  onProvider,
  align = 'start',
  ariaLabel = 'provider',
}: Props) => {
  const {
    open,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
    popupStyle,
    portal,
    portalTarget,
  } = useDropdown({
    disabled,
    align,
    expectedHeight: 64,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
    strategy: 'fixed',
  });
  const summary = PROVIDER_LABEL[provider];

  return (
    <div ref={containerRef} className="relative flex w-full items-center">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        title={disabled ? summary : `${summary}. Click to change.`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${summary}`}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <ProviderGlyph id={provider} />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open ? (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel={ariaLabel}
            className={cn(popupClassName, 'bg-subtle')}
            style={popupStyle}
          >
            <PickerSection label="Provider" hint="Which CLI agent starts new sessions">
              <ProviderGrid
                connectedProviders={connectedProviders}
                activeProvider={provider}
                disableDisconnected
                onSelect={(nextProvider) => {
                  onProvider(nextProvider);
                  close();
                }}
              />
            </PickerSection>
          </Popover>
        ) : null}
      </DropdownPortal>
    </div>
  );
};
