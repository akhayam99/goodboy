import { useEffect, useRef, type ReactNode } from 'react';
import { AnchoredPopover, PopoverBody, useDropdown } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { DraftRoutingBody } from './DraftRoutingBody';

type Props = {
  readonly sessionId: SessionId;
  readonly request: number;
  readonly children: ReactNode;
};

const DRAFT_MODEL_LABEL = 'Model for drafts';

export const DraftModelPicker = ({ sessionId, request, children }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 420,
    expectedWidth: 360,
    width: 'w-[22.5rem] max-w-[calc(100vw-2rem)]',
  });
  const { open, toggle, close } = dropdown;
  const handled = useRef(request);

  useEffect(() => {
    if (request === handled.current) {
      return;
    }
    handled.current = request;
    if (!open) {
      toggle();
    }
  }, [open, request, toggle]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={DRAFT_MODEL_LABEL}
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName="flex shrink-0"
      trigger={children}
    >
      <PopoverBody>
        <p className="px-3 pb-1 pt-2 text-heading text-foreground">{DRAFT_MODEL_LABEL}</p>
        <DraftRoutingBody sessionId={sessionId} onClose={close} />
      </PopoverBody>
    </AnchoredPopover>
  );
};
