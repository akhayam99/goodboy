import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { captureReturnFocus } from '../confirmReturnFocus';
import { useDropdown } from '../useDropdown';
import { useEscapeLayer } from '../useEscapeLayer';
import { AnchoredPopover } from './AnchoredPopover';
import { InlineConfirm } from './InlineConfirm';

export type ConfirmPopoverTriggerParams = {
  readonly isArmed: boolean;
  readonly arm: () => void;
};

export type ConfirmPopoverWidth = 'w-80' | 'w-96';

export type ConfirmReturnFocus = {
  readonly rowSelector: string;
};

type InlineConfirmProps = ComponentProps<typeof InlineConfirm>;

export type ConfirmPopoverProps = Omit<
  InlineConfirmProps,
  'onCancel' | 'surface' | 'className' | 'autoDisarmMs'
> & {
  readonly trigger: (params: ConfirmPopoverTriggerParams) => ReactNode;
  readonly onCancel?: () => void;
  readonly isOpen?: boolean;
  readonly width?: ConfirmPopoverWidth;
  readonly align?: 'start' | 'end';
  readonly anchorClassName?: string;
  readonly returnFocusTo?: ConfirmReturnFocus;
};

const CANCEL_SELECTOR = '[data-confirm-cancel]';
const ACTION_SELECTOR = '[data-confirm-action]';
const TRIGGER_SELECTOR = 'button, [href], [role="button"]';

type FocusParams = {
  readonly root: HTMLElement | null;
  readonly selector: string;
};

const focusFirst = ({ root, selector }: FocusParams) => {
  const target = root?.querySelector(selector);
  if (target instanceof HTMLElement) {
    target.focus();
  }
};

const trapTab = (event: KeyboardEvent<HTMLElement>) => {
  const buttons = [...event.currentTarget.querySelectorAll('button:not([disabled])')].filter(
    (button): button is HTMLElement => button instanceof HTMLElement,
  );
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (first === undefined || last === undefined) {
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

const pressConfirm = (event: KeyboardEvent<HTMLElement>) => {
  const action = event.currentTarget.querySelector(ACTION_SELECTOR);
  if (!(action instanceof HTMLButtonElement) || action.disabled) {
    return;
  }
  event.preventDefault();
  action.click();
};

export const ConfirmPopover = ({
  trigger,
  onConfirm,
  onCancel,
  isOpen,
  width = 'w-80',
  align = 'end',
  anchorClassName = 'flex shrink-0 items-center',
  returnFocusTo,
  title,
  isBusy = false,
  ...confirmProps
}: ConfirmPopoverProps) => {
  const dropdown = useDropdown({
    align,
    width,
    expectedWidth: width === 'w-96' ? 384 : 320,
    isEscapeEnabled: false,
  });
  const wasOpen = useRef(false);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const [isRunning, setIsRunning] = useState(false);
  const { open, close, toggle, containerRef, popupRef } = dropdown;
  const isWorking = isBusy || isRunning;

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

  useEffect(() => {
    if (!open) {
      return;
    }
    const armed = containerRef.current?.querySelector(TRIGGER_SELECTOR);
    if (!(armed instanceof HTMLElement) || armed.getAttribute('aria-expanded') === 'true') {
      return;
    }
    const previous = armed.getAttribute('aria-expanded');
    armed.setAttribute('aria-expanded', 'true');
    return () => {
      if (previous === null) {
        armed.removeAttribute('aria-expanded');
        return;
      }
      armed.setAttribute('aria-expanded', previous);
    };
  }, [open, containerRef]);

  const role = confirmProps.role;
  const hasOpened = useRef(false);
  useEffect(() => {
    if (open) {
      hasOpened.current = true;
      focusFirst({
        root: popupRef.current,
        selector: role === 'danger' ? CANCEL_SELECTOR : ACTION_SELECTOR,
      });
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
  }, [open, popupRef, containerRef, role]);

  const cancel = () => {
    if (isWorking) {
      return;
    }
    close();
    if (isOpen !== undefined) {
      return;
    }
    onCancel?.();
  };

  useEscapeLayer(cancel, open);

  const confirm = async () => {
    const restoreFocus =
      returnFocusTo === undefined
        ? undefined
        : captureReturnFocus({
            anchor: containerRef.current,
            rowSelector: returnFocusTo.rowSelector,
          });
    setIsRunning(true);
    try {
      await onConfirm();
    } finally {
      setIsRunning(false);
    }
    if (isOpen === undefined) {
      close();
    }
    if (restoreFocus !== undefined) {
      window.setTimeout(restoreFocus, 0);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      pressConfirm(event);
      return;
    }
    if (event.key === 'Tab') {
      trapTab(event);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      anchorClassName={anchorClassName}
      trigger={trigger({ isArmed: open, arm })}
    >
      <div className="contents" onKeyDown={onKeyDown}>
        <InlineConfirm
          {...confirmProps}
          title={title}
          isBusy={isWorking}
          surface="plain"
          onConfirm={confirm}
          onCancel={cancel}
        />
      </div>
    </AnchoredPopover>
  );
};
