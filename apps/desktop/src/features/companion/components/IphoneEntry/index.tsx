import { Smartphone } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  cn,
  FOCUS_RING,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  StatusMark,
  Tooltip,
  TOP_BAR_CONTROL,
  useDropdown,
} from '@goodboy/ui';
import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import { useIphoneBarIconStore } from '../../iphoneBarIconStore';
import { linkOf } from '../../linkOf';
import { EntryFacts } from './EntryFacts';
import { entryToneOf } from './entryToneOf';
import { entryWordOf } from './entryWordOf';
import { useBridgeLink } from './useBridgeLink';

const TOOLTIP_NONE = 'Pair an iPhone';

export const IphoneEntry = () => {
  const isShown = useIphoneBarIconStore((state) => state.isShown);
  const { status, phones } = useBridgeLink();
  const dropdown = useDropdown({
    align: 'end',
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const now = useNow(30_000, isOpen);
  const link = linkOf({ status, phones });
  const tone = entryToneOf({ state: link.state });
  const word = entryWordOf({ state: link.state });
  const label = `${NAMES.iphone}, ${word}`;
  const tooltip = link.state === 'none' ? TOOLTIP_NONE : label;

  const openSettings = () => {
    close();
    dispatchWindowEvent({ name: 'goodboy:open-pair-device' });
  };

  if (!isShown) {
    return null;
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="iPhone"
      hasBackdrop
      trigger={
        <Tooltip content={tooltip} side="bottom">
          <button
            type="button"
            data-iphone-entry={link.state}
            aria-label={label}
            aria-expanded={link.state === 'none' ? undefined : isOpen}
            onClick={link.state === 'none' ? openSettings : toggle}
            className={cn(
              TOP_BAR_CONTROL.height,
              TOP_BAR_CONTROL.radius,
              FOCUS_RING,
              'flex shrink-0 items-center px-1 motion-safe:transition-colors',
              isOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-hover',
            )}
          >
            <span className="flex size-6 items-center justify-center">
              <Smartphone size={ICON_SIZE.control} aria-hidden />
            </span>
            {tone === null ? null : <StatusMark mark={{ kind: 'dot', tone }} />}
          </button>
        </Tooltip>
      }
    >
      <EntryFacts
        state={link.state}
        phone={link.phone}
        fault={status?.fault ?? null}
        now={now}
        onOpenSettings={openSettings}
      />
    </AnchoredPopover>
  );
};
