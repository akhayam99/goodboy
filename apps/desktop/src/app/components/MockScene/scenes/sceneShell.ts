import type { ColumnPlace } from '../../SideColumn/columnPlace';
import type { FooterTarget } from '../../../hooks/useAppOverlays/overlayState';

export const sceneColumnPlace = ({ target }: { readonly target: FooterTarget }): ColumnPlace => {
  switch (target.place) {
    case 'inbox':
      return 'inbox';
    case 'workflows':
      return 'workflows';
    case 'settings':
      return 'settings';
    case 'impact':
      return 'impact';
    case 'changelog':
      return 'whatsNew';
    case 'guide':
      return 'guide';
    case 'link':
    case null:
      return null;
    default: {
      const unreachable: never = target.place;
      return unreachable;
    }
  }
};
