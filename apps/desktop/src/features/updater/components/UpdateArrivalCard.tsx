import { useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpCircle } from 'lucide-react';
import {
  Button,
  InlineConfirm,
  Popover,
  useDropdownDirection,
  useEscapeLayer,
  usePopoverPortalTarget,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { useAppStore } from '../../../store';
import { useRunningAgentCount } from '../hooks/useRunningAgentCount';
import { useUpdateArrivalCard } from '../hooks/useUpdateArrivalCard';
import { arrivalTitle } from '../updateArrivalCopy';

const CARD_MAX_WIDTH_PX = 384;
const CARD_EXPECTED_HEIGHT_PX = 112;
const WINDOW_MARGIN_PX = 12;

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onOpenChangelog: () => void;
};

export const UpdateArrivalCard = ({ anchorRef, onOpenChangelog }: Props) => {
  const version = useAppStore((state) => state.updateVersion);
  const applyUpdate = useAppStore((state) => state.applyUpdate);
  const setUpdateQueuedUntilIdle = useAppStore((state) => state.setUpdateQueuedUntilIdle);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const runningCount = useRunningAgentCount();
  const { isVisible, snooze } = useUpdateArrivalCard();
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const layerTarget = usePopoverPortalTarget();
  const placement = useDropdownDirection({
    triggerRef: anchorRef,
    popupRef,
    open: isVisible,
    expectedHeight: CARD_EXPECTED_HEIGHT_PX,
    expectedWidth: CARD_MAX_WIDTH_PX,
    align: 'start',
    shouldMatchTriggerWidth: false,
    viewportMargin: WINDOW_MARGIN_PX,
    maxWidth: CARD_MAX_WIDTH_PX,
  });

  const dismiss = () => {
    snooze();
    anchorRef.current?.querySelector<HTMLElement>('button')?.focus();
  };

  useEscapeLayer(dismiss, isVisible);

  if (!isVisible) {
    return null;
  }

  const title = arrivalTitle({ version });
  const isConfirming = isConfirmingRestart && runningCount > 0;
  const portalTarget = layerTarget ?? anchorRef.current?.closest('dialog[open]') ?? document.body;

  return createPortal(
    <div data-dropdown-portal>
      <Popover
        innerRef={popupRef}
        role="dialog"
        ariaLabel={isConfirming ? 'Restart while agents run' : title}
        style={placement}
        className={placement === undefined ? 'invisible fixed z-popover' : 'fixed z-popover w-max'}
      >
        {isConfirming ? (
          <InlineConfirm
            role="alert"
            surface="plain"
            icon={<ArrowUpCircle size={ICON_SIZE.control} aria-hidden />}
            title={`${runningCount} agent${runningCount === 1 ? '' : 's'} ${runningCount === 1 ? 'is' : 'are'} running. A restart now picks them up where they stopped.`}
            confirmLabel="Restart when they finish"
            cancelLabel="Restart now"
            onConfirm={() => {
              setUpdateQueuedUntilIdle({ queued: true });
              setIsConfirmingRestart(false);
            }}
            onCancel={() => {
              void applyUpdate();
            }}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-3 p-3">
            <div className="flex min-w-0 items-start gap-2">
              <span className="flex h-5 shrink-0 items-center text-primary">
                <ArrowUpCircle size={ICON_SIZE.control} aria-hidden />
              </span>
              <p className="min-w-0 break-words text-heading text-foreground">{title}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Later
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  focusChangelogRelease({ version });
                  onOpenChangelog();
                }}
              >
                What's new
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (runningCount > 0) {
                    setIsConfirmingRestart(true);
                    return;
                  }
                  void applyUpdate();
                }}
              >
                Restart now
              </Button>
            </div>
          </div>
        )}
      </Popover>
    </div>,
    portalTarget,
  );
};
