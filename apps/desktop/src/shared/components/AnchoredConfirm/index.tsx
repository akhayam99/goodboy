import type { ComponentProps } from 'react';
import { ConfirmPopover } from '@goodboy/ui';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';

type Props = Omit<
  ComponentProps<typeof ConfirmPopover>,
  'trigger' | 'anchorClassName' | 'isOpen'
> & {
  readonly isOpen: boolean;
  readonly anchorClassName?: string;
};

const POINT_ANCHOR = 'absolute right-0 bottom-0 size-0';

export const AnchoredConfirm = ({ anchorClassName = POINT_ANCHOR, ...props }: Props) => {
  useRestoreFocus({ isOpen: props.isOpen });
  return (
    <ConfirmPopover
      {...props}
      anchorClassName={anchorClassName}
      trigger={() => <span aria-hidden className="size-0" />}
    />
  );
};
