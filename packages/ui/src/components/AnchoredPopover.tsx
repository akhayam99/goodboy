import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import type { DropdownController } from '../useDropdown';
import { DropdownBackdrop } from '../useDropdown/DropdownBackdrop';
import { Popover } from './Popover';
import { useMenuKeys } from './ContextMenu/useMenuKeys';

export type AnchoredPopoverProps = {
  readonly dropdown: DropdownController;
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly role?: 'menu' | 'dialog' | 'listbox';
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly anchorClassName?: string;
  readonly hasBackdrop?: boolean;
  readonly tabIndex?: number;
};

export const AnchoredPopover = ({
  dropdown,
  trigger,
  children,
  role,
  ariaLabel,
  className,
  anchorClassName,
  hasBackdrop = false,
  tabIndex,
}: AnchoredPopoverProps) => {
  const onMenuKeyDown = useMenuKeys({
    containerRef: dropdown.popupRef,
    isOpen: dropdown.open,
    isEnabled: role === 'menu',
  });
  return (
    <div ref={dropdown.containerRef} className={cn('relative', anchorClassName)}>
      {trigger}
      {dropdown.open && children != null
        ? createPortal(
            <div data-dropdown-portal>
              {hasBackdrop ? <DropdownBackdrop onClose={dropdown.close} /> : null}
              <Popover
                innerRef={dropdown.popupRef}
                role={role}
                ariaLabel={ariaLabel}
                tabIndex={tabIndex}
                onKeyDown={onMenuKeyDown}
                style={dropdown.popupStyle}
                className={cn(dropdown.popupClassName, className)}
              >
                {children}
              </Popover>
            </div>,
            dropdown.portalTarget,
          )
        : null}
    </div>
  );
};
