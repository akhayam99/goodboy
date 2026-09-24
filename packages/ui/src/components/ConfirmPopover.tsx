import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { useDropdown } from '../useDropdown';
import { AnchoredPopover } from './AnchoredPopover';
import { InlineConfirm } from './InlineConfirm';

export type ConfirmPopoverTriggerParams = {
  readonly isArmed: boolean;
  readonly arm: () => void;
};

export type ConfirmPopoverWidth = 'w-80' | 'w-96';

type InlineConfirmProps = ComponentProps<typeof InlineConfirm>;

export type ConfirmPopoverProps = Omit<InlineConfirmProps, 'onCancel' | 'surface' | 'className'> & {
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly onCancel?: () => void;
  readonly isOpen?: boolean;
  readonly width?: ConfirmPopoverWidth;
  readonly align?: 'start' | 'end';
  readonly anchorClassName?: string;
};

const focusFirst = ({
  root,
  selector,
}: {
  readonly root: HTMLElement | null;
  readonly selector: string;
}) => {
  const target = root?.querySelector(selector);
  if (target instanceof HTMLElement) {
    target.focus();
  }
};

export const ConfirmPopover = ({
  trigger,
  onConfirm,
  onCancel,
  isOpen,
  width = 'w-80',
  align = 'end',
  anchorClassName = 'flex shrink-0 items-center',
  title,
  ...confirmProps
}: ConfirmPopoverProps) => {
  const dropdown = useDropdown({ align, width, expectedWidth: width === 'w-96' ? 384 : 320 });
  const wasOpen = useRef(false);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const { open, close, toggle, containerRef, popupRef } = dropdown;

  const arm = useCallback(() => {
    if (open) {
      return;
    }
    toggle();
  }, [open, toggle]);

  useEffect(() => {
    const closedItself = wasOpen.current && !open;
    wasOpen.current = open;
    if (isOpen === undefined) {
      return;
    }
    if (closedItself && isOpen) {
      cancelRef.current?.();
      return;
    }
    if (isOpen !== open) {
      toggle();
    }
  }, [isOpen, open, toggle]);

  const hasOpened = useRef(false);
  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      focusFirst({ root: popupRef.current, selector: '[data-confirm-cancel]' });
      return;
    }
    if (!hasOpened.current) {
      return;
    }
    hasOpened.current = false;
    const active = document.activeElement;
    if (active !== null && active !== document.body) {
      return;
    }
    focusFirst({ root: containerRef.current, selector: 'button, [href], [tabindex]' });
  }, [open, popupRef, containerRef]);

  const cancel = () => {
    close();
    if (isOpen !== undefined) {
      return;
    }
    onCancel?.();
  };

  const confirm = async () => {
    await onConfirm();
    if (isOpen !== undefined) {
      return;
    }
    close();
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      anchorClassName={anchorClassName}
      trigger={trigger({ isArmed: open, arm })}
    >
      <InlineConfirm
        {...confirmProps}
        title={title}
        surface="plain"
        onConfirm={confirm}
        onCancel={cancel}
      />
    </AnchoredPopover>
  );
};
