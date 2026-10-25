import { useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  Popover,
  cn,
  useDropdownDirection,
  useEscapeLayer,
  usePopoverPortalTarget,
} from '@goodboy/ui';
import { useIsAnchorInert } from '../hooks/useIsAnchorInert';
import { useUpdateArrivalCard } from '../hooks/useUpdateArrivalCard';
import { useUpdateCard } from '../hooks/useUpdateCard';
import type { UpdateCardState } from '../updateCardState';
import { UpdateCardMark } from './UpdateCardMark';
import { UpdateVerbButtons } from './UpdateVerbButtons';

const CARD_WIDTH_PX = 300;
const WIDE_STATES: ReadonlySet<UpdateCardState> = new Set(['running', 'queued']);
const CARD_MAX_WIDTH_PX = 384;
const CARD_EXPECTED_HEIGHT_PX = 112;
const WINDOW_MARGIN_PX = 12;

type Props = {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onOpenChangelog: () => void;
};

export const UpdateArrivalCard = ({ anchorRef, onOpenChangelog }: Props) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const layerTarget = usePopoverPortalTarget();

  const focusAnchor = (): void => {
    const anchor = anchorRef.current;
    const target =
      anchor?.querySelector<HTMLElement>('[data-update-pill]') ??
      anchor?.querySelector<HTMLElement>('button');
    target?.focus();
  };

  const card = useUpdateCard({
    onLater: () => dismiss(),
    onOpenChangelog,
  });
  const { isVisible: isWanted, snooze } = useUpdateArrivalCard({ state: card.state });
  const isAnchorInert = useIsAnchorInert({ anchorRef });
  const isVisible = isWanted && !isAnchorInert;

  const dismiss = (): void => {
    snooze();
    focusAnchor();
  };

  const placement = useDropdownDirection({
    triggerRef: anchorRef,
    popupRef,
    open: isVisible,
    expectedHeight: CARD_EXPECTED_HEIGHT_PX,
    expectedWidth: CARD_WIDTH_PX,
    align: 'start',
    shouldMatchTriggerWidth: false,
    viewportMargin: WINDOW_MARGIN_PX,
    maxWidth: CARD_MAX_WIDTH_PX,
  });

  useEscapeLayer(dismiss, isVisible);

  if (!isVisible || card.state === null || card.copy === null) {
    return null;
  }

  const { state, copy } = card;
  const portalTarget = layerTarget ?? anchorRef.current?.closest('dialog[open]') ?? document.body;

  return createPortal(
    <div data-dropdown-portal>
      <Popover
        innerRef={popupRef}
        role="dialog"
        ariaLabel={copy.title}
        style={placement}
        className={cn(
          'fixed z-popover',
          WIDE_STATES.has(state) ? 'w-90' : 'w-75',
          placement === undefined ? 'invisible' : '',
        )}
      >
        <div data-update-card={state} className="flex min-w-0 flex-col gap-3 p-3">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={cn(
                'flex h-5 shrink-0 items-center',
                state === 'failed' ? 'text-danger' : 'text-primary',
              )}
            >
              <UpdateCardMark state={state} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="min-w-0 break-words text-heading text-foreground">{copy.title}</p>
              <p className="min-w-0 break-words text-meta text-muted-foreground">{copy.body}</p>
              {copy.detail === null ? null : (
                <p className="min-w-0 break-words text-meta text-faint-foreground">{copy.detail}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <UpdateVerbButtons verbs={card.verbs} />
          </div>
        </div>
      </Popover>
    </div>,
    portalTarget,
  );
};
