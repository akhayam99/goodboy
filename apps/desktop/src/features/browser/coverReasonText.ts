import type { CoverReason } from './createOverlayWatch';

type Params = {
  readonly reason: CoverReason;
};

export const coverReasonText = ({ reason }: Params): string => {
  switch (reason) {
    case 'menu':
      return 'Hidden while a menu is open';
    case 'dialog':
      return 'Hidden while a dialog is open';
    case 'tooltip':
      return 'Hidden while a tip shows';
    case 'page':
      return 'Hidden while a page is open';
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
};
