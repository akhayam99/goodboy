import { useEffect, useRef } from 'react';
import {
  AnchoredPopover,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  StatusDot,
  Tooltip,
  cn,
  useDropdown,
  FOCUS_RING,
} from '@goodboy/ui';
import { useUpdateCardState } from '../../../features/updater/hooks/useUpdateCardState';
import { updatePillLabel } from '../../../features/updater/updateCardCopy';
import { toggleUpdateCard } from '../../../features/updater/updateCardRequest';
import { UpdatePill } from '../../../features/updater/components/UpdatePill';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import { useInstalledVersion } from '../../../features/changelog/hooks/useInstalledVersion';
import { openReportSheet } from '../../../features/bug-report/openReportSheet';
import { useHasBugReportDraft } from '../../../features/bug-report/hooks/useHasBugReportDraft';
import { openUrl } from '../../../shared/lib/editor';
import { SPONSOR_URL } from '../../../shared/lib/productLinks';
import { GoodboyChipLabel, type GoodboyChipState } from './GoodboyChipLabel';
import { GoodboyChipEffects } from './GoodboyChipEffects';
import { GoodboyMenu } from './GoodboyMenu';

const OPEN_GOODBOY_MENU_EVENT = 'goodboy:open-goodboy-menu';
const OPEN_PAIR_DEVICE_EVENT = 'goodboy:open-pair-device';

type GoodboyChipVariant = 'column' | 'rail';

type Props = {
  readonly onOpenChangelog: () => void;
  readonly onOpenGuide: () => void;
  readonly onOpenShortcuts: () => void;
  readonly variant?: GoodboyChipVariant;
  readonly isPrimary?: boolean;
  readonly isCurrent?: boolean;
};

const REST_LABEL = 'Goodboy beta: version, help and sponsor';

const TRIGGER_LABEL: Record<GoodboyChipState, string> = {
  update: REST_LABEL,
  rest: REST_LABEL,
};

const TRIGGER_SHAPE: Record<GoodboyChipVariant | 'column-pill', string> = {
  column: 'h-7 min-w-0 flex-1 gap-2 overflow-hidden px-2',
  'column-pill': 'h-7 min-w-0 shrink gap-2 overflow-hidden px-2',
  rail: 'size-8 shrink-0 justify-center',
};

export const GoodboyChip = ({
  onOpenChangelog,
  onOpenGuide,
  onOpenShortcuts,
  variant = 'column',
  isPrimary = true,
  isCurrent = false,
}: Props) => {
  const update = useUpdateCardState();
  const version = useInstalledVersion();
  const hasDraft = useHasBugReportDraft();
  const dropdown = useDropdown({
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    ...(isPrimary && { openEvent: OPEN_GOODBOY_MENU_EVENT }),
  });
  const { open: isOpen, close, toggle } = dropdown;
  const hasUpdate = update.state !== null;
  const state: GoodboyChipState = hasUpdate ? 'update' : 'rest';
  const isInMainWindow = useIsMainWindow();
  const hasRowPill = variant === 'column' && hasUpdate;
  const railUpdate =
    variant === 'rail' && update.state !== null
      ? {
          label: updatePillLabel({
            state: update.state,
            version: update.version,
            runningCount: update.runningCount,
          }),
          onOpen: toggleUpdateCard,
        }
      : null;

  useEffect(() => {
    if (!isPrimary || isInMainWindow) {
      return;
    }
    const onFocus = () => {
      void hydrateOnboardingFromDb();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isPrimary, isInMainWindow]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!wasOpen || isOpen) {
      return;
    }
    const focused = document.activeElement;
    if (focused !== null && focused !== document.body) {
      return;
    }
    dropdown.containerRef.current?.querySelector<HTMLElement>('[data-goodboy-chip]')?.focus();
  }, [isOpen, dropdown.containerRef]);

  const leaveFor =
    ({ action }: { readonly action: () => void }) =>
    () => {
      close();
      action();
    };

  const menuTrigger = (
    <Tooltip
      content={TRIGGER_LABEL[state]}
      side={variant === 'rail' ? 'right' : 'top'}
      isSuppressed={isOpen}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={TRIGGER_LABEL[state]}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-current={isCurrent ? 'page' : undefined}
        data-testid={isPrimary ? 'goodboy-chip' : undefined}
        data-goodboy-chip={variant}
        className={cn(
          'relative flex items-center rounded-md text-meta motion-safe:transition-colors',
          FOCUS_RING,
          TRIGGER_SHAPE[hasRowPill ? 'column-pill' : variant],
          isOpen && 'bg-muted',
          !isOpen && isCurrent && 'bg-selected text-foreground',
          !isOpen && !isCurrent && 'hover:bg-hover',
        )}
      >
        <GoodboyChipLabel
          state={state}
          installedVersion={version}
          isMarkOnly={variant === 'rail'}
        />
        {variant === 'rail' && state !== 'rest' ? (
          <StatusDot tone="primary" size="sm" className="absolute right-1 top-1" />
        ) : null}
      </button>
    </Tooltip>
  );

  const trigger = hasRowPill ? (
    <>
      {menuTrigger}
      <UpdatePill tooltipSide="top" />
    </>
  ) : (
    menuTrigger
  );

  return (
    <>
      {isPrimary ? (
        <GoodboyChipEffects
          anchorRef={dropdown.containerRef}
          onOpenChangelog={leaveFor({ action: onOpenChangelog })}
        />
      ) : null}
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Goodboy"
        hasBackdrop
        className="flex flex-col"
        anchorClassName={
          variant === 'column' ? '@container flex min-w-0 flex-1 items-center gap-1' : 'flex'
        }
        trigger={trigger}
      >
        <GoodboyMenu
          version={version}
          hasDraft={hasDraft}
          railUpdate={railUpdate}
          onClose={close}
          onReport={leaveFor({ action: () => openReportSheet() })}
          onOpenGuide={leaveFor({ action: onOpenGuide })}
          onPairDevice={leaveFor({
            action: () => window.dispatchEvent(new CustomEvent(OPEN_PAIR_DEVICE_EVENT)),
          })}
          onOpenChangelog={leaveFor({ action: onOpenChangelog })}
          onOpenShortcuts={leaveFor({ action: onOpenShortcuts })}
          onSponsor={() => {
            void openUrl(SPONSOR_URL);
          }}
        />
      </AnchoredPopover>
    </>
  );
};
