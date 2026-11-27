import { Smartphone } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  Button,
  cn,
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
import { useAppStore } from '../../../../store';
import { useCompanionInitialRead } from '../../hooks/useCompanionInitialRead';
import { useCompanionLinkPoll } from '../../hooks/useCompanionLinkPoll';
import { useIphoneBarIconStore } from '../../iphoneBarIconStore';
import { linkOf } from '../../linkOf';
import { linkWordOf } from '../../linkWordOf';
import { EntryFacts } from './EntryFacts';
import { entryToneOf } from './entryToneOf';
import { tooltipOf } from './tooltipOf';

export const IphoneEntry = () => {
  const isShown = useIphoneBarIconStore((state) => state.isShown);
  const status = useAppStore((state) => state.companionStatus);
  const phones = useAppStore((state) => state.companionPhones);
  const isPageOpen = useAppStore((state) => state.isCompanionPageOpen);
  const hint = useAppStore((state) => state.companionHint);
  const dropdown = useDropdown({
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const link = linkOf({ status, phones, hint });
  const now = useNow(30_000, isOpen || link.phone !== null);
  const tone = entryToneOf({ state: link.state });
  const label = `${NAMES.iphone}, ${linkWordOf({ state: link.state })}`;

  const hasPrior = (hint?.priorPhoneCount ?? 0) > 0;
  useCompanionInitialRead({ isOn: isShown });
  useCompanionLinkPoll({ isOn: isShown && (phones.length > 0 || hasPrior) });

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
        <Tooltip content={tooltipOf({ link, now })} side="top">
          <Button
            variant="quiet"
            size="sm"
            data-iphone-entry={link.state}
            aria-label={label}
            aria-expanded={link.state === 'none' ? undefined : isOpen}
            aria-current={isPageOpen ? 'page' : undefined}
            onClick={link.state === 'none' ? openSettings : toggle}
            className={cn(
              TOP_BAR_CONTROL.height,
              tone === null ? cn(TOP_BAR_CONTROL.square, 'p-0') : 'min-w-7 gap-1 px-1',
              TOP_BAR_CONTROL.radius,
              'shrink-0 font-normal',
              isOpen && 'bg-muted text-foreground',
              !isOpen && isPageOpen && 'bg-selected text-foreground',
            )}
          >
            <Smartphone size={ICON_SIZE.control} aria-hidden />
            {tone === null ? null : <StatusMark mark={{ kind: 'dot', tone }} />}
          </Button>
        </Tooltip>
      }
    >
      <EntryFacts
        state={link.state}
        phone={link.phone}
        fault={status?.fault ?? hint?.fault ?? null}
        now={now}
        onOpenSettings={openSettings}
      />
    </AnchoredPopover>
  );
};
