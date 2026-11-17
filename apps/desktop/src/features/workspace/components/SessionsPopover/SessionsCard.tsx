import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  Popover,
  SHELL_GUTTER_PX,
  cn,
  useDropdownDirection,
  usePopoverPortalTarget,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useIsAnchorInert } from '../../../../shared/hooks/useIsAnchorInert';

const CARD_EXPECTED_HEIGHT_PX = 120;

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly isSessionsOpen: boolean;
  readonly onShow: () => void;
};

export const SessionsCard = ({ anchorRef, isSessionsOpen, onShow }: Props) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const layerTarget = usePopoverPortalTarget();
  const phase = useAppStore((state) => state.sessionsCardPhase);
  const hydrate = useAppStore((state) => state.hydrateSessionsCard);
  const isAnchorInert = useIsAnchorInert({ anchorRef });
  const isVisible = phase === 'open' && !isSessionsOpen && !isAnchorInert;

  useEffect(() => {
    const onFocus = (): void => {
      void hydrate();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hydrate]);

  const placement = useDropdownDirection({
    triggerRef: anchorRef,
    popupRef,
    open: isVisible,
    expectedHeight: CARD_EXPECTED_HEIGHT_PX,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    align: 'start',
    shouldMatchTriggerWidth: false,
    viewportMargin: SHELL_GUTTER_PX,
    maxWidth: POPOVER_WIDTH_PX.standard,
  });

  if (!isVisible) {
    return null;
  }

  const portalTarget = layerTarget ?? anchorRef.current?.closest('dialog[open]') ?? document.body;

  return createPortal(
    <div data-dropdown-portal>
      <Popover
        innerRef={popupRef}
        role="dialog"
        ariaLabel="Your sessions moved here"
        style={placement}
        className={cn(
          'fixed z-popover',
          POPOVER_WIDTH_CLASS.standard,
          placement === undefined ? 'invisible' : '',
        )}
      >
        <div data-sessions-card="" className="flex min-w-0 flex-col gap-3 p-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="min-w-0 break-words text-heading text-foreground">
              Your sessions moved here
            </p>
            <p className="min-w-0 break-words text-meta text-muted-foreground">
              The sidebar list is gone. Press {shortcutGlyphs('sessions.toggle')} from anywhere, or
              open the Board.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="primary" size="sm" onClick={onShow}>
              Show sessions
            </Button>
          </div>
        </div>
      </Popover>
    </div>,
    portalTarget,
  );
};
